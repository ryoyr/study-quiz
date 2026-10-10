type Props = {
  text: string;
  className?: string;
};

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; items: string[] };

const blocksOf = (text: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ kind: "list", items: list });
    list = [];
  };
  for (const rawLine of text.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/u.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
};

export default function StructuredText({ text, className = "" }: Props) {
  const blocks = blocksOf(text);
  return (
    <div className={`structured-text ${className}`.trim()}>
      {blocks.map((block, index) =>
        block.kind === "list" ? (
          <ul key={`list-${index}`}>
            {block.items.map((item, itemIndex) => (
              <li key={`${itemIndex}-${item}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={`paragraph-${index}`}>
            {block.lines.map((line, lineIndex) => (
              <span key={`${lineIndex}-${line}`}>
                {line}
                {lineIndex < block.lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
