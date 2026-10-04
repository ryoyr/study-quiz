import type { Question } from '../types/Question';

export type CsvRowStatus = 'valid' | 'warning' | 'error';
export interface CsvPreviewRow { rowNumber:number; status:CsvRowStatus; messages:string[]; question:Question|null; }
export interface CsvParseResult { headers:string[]; rows:CsvPreviewRow[]; fatalErrors:string[]; validCount:number; warningCount:number; errorCount:number; }

const REQUIRED=['id','category','text','choice1','choice2','answer'];
const OPTIONAL=['choice3','choice4','explanation','weight','difficulty'];

const parseMatrix=(source:string):string[][]=>{
 const text=source.replace(/^\uFEFF/,''); const rows:string[][]=[]; let row:string[]=[]; let field=''; let quoted=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"'){quoted=false;}else{field+=ch;}}else if(ch==='"'){quoted=true;}else if(ch===','){row.push(field);field='';}else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v!==''))rows.push(row);row=[];field='';}else{field+=ch;}}
 if(quoted)throw new Error('ダブルクォートが閉じられていません。'); row.push(field); if(row.some(v=>v!==''))rows.push(row); return rows;
};
const numberValue=(value:string,fallback:number)=>value.trim()===''?fallback:Number(value);
export const parseQuestionCsv=(text:string,existing:Question[]):CsvParseResult=>{
 let matrix:string[][];try{matrix=parseMatrix(text);}catch(error){return{headers:[],rows:[],fatalErrors:[error instanceof Error?error.message:'CSV解析に失敗しました。'],validCount:0,warningCount:0,errorCount:0};}
 if(matrix.length===0)return{headers:[],rows:[],fatalErrors:['CSVにデータがありません。'],validCount:0,warningCount:0,errorCount:0};
 const headers=matrix[0].map(v=>v.trim()); const duplicateHeaders=headers.filter((h,i)=>headers.indexOf(h)!==i); const missing=REQUIRED.filter(h=>!headers.includes(h)); const unknown=headers.filter(h=>![...REQUIRED,...OPTIONAL].includes(h)); const fatalErrors:string[]=[];
 if(missing.length)fatalErrors.push(`必須列が不足しています: ${missing.join(', ')}`); if(duplicateHeaders.length)fatalErrors.push(`ヘッダーが重複しています: ${[...new Set(duplicateHeaders)].join(', ')}`); if(unknown.length)fatalErrors.push(`未対応の列があります: ${unknown.join(', ')}`); if(fatalErrors.length)return{headers,rows:[],fatalErrors,validCount:0,warningCount:0,errorCount:0};
 const index=Object.fromEntries(headers.map((h,i)=>[h,i])); const existingIds=new Set(existing.map(q=>q.id)); const csvIds=new Set<string>();
 const rows=matrix.slice(1).map((values,offset):CsvPreviewRow=>{const get=(name:string)=>values[index[name]]?.trim()??'';const messages:string[]=[];const warnings:string[]=[];const id=get('id');const category=get('category');const textValue=get('text');const choices=[get('choice1'),get('choice2'),get('choice3'),get('choice4')].filter(Boolean);const answer=Number(get('answer'));const weight=numberValue(get('weight'),1);const difficulty=numberValue(get('difficulty'),1);
 if(values.length!==headers.length)messages.push(`列数が不一致です。期待${headers.length}列、実際${values.length}列。`); if(!id)messages.push('idは必須です。');if(!category)messages.push('categoryは必須です。');if(!textValue)messages.push('textは必須です。');if(choices.length<2)messages.push('選択肢は2件以上必要です。');if(!Number.isInteger(answer)||answer<1||answer>choices.length)messages.push('answerは存在する選択肢番号（1開始）で指定してください。');if(!Number.isFinite(weight)||weight<=0)messages.push('weightは0より大きい数値です。');if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5)messages.push('difficultyは1～5の整数です。');if(existingIds.has(id))messages.push('既存の問題IDと重複しています。');if(csvIds.has(id))messages.push('CSV内で問題IDが重複しています。');if(id)csvIds.add(id);if(!get('explanation'))warnings.push('解説が未入力です。');
 const all=[...messages,...warnings];const status:CsvRowStatus=messages.length?'error':warnings.length?'warning':'valid';const question=messages.length?null:{id,category,text:textValue,choices,answerIndex:answer-1,explanation:get('explanation'),weight,difficulty};return{rowNumber:offset+2,status,messages:all,question};});
 return{headers,rows,fatalErrors,validCount:rows.filter(r=>r.status==='valid').length,warningCount:rows.filter(r=>r.status==='warning').length,errorCount:rows.filter(r=>r.status==='error').length};
};
export const questionsFromPreview=(result:CsvParseResult):Question[]=>result.rows.filter(r=>r.question!==null).map(r=>r.question as Question);
export const CSV_TEMPLATE='id,category,text,choice1,choice2,choice3,choice4,answer,explanation,weight,difficulty\nLINUX-001,Linux,lsコマンドの用途は？,一覧表示,削除,移動,圧縮,1,ディレクトリの内容を一覧表示します。,3,2\n';
