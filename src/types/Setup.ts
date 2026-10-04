export interface Setup {
  name: string;

  examDate: string;

  dailyNewLimit: number;

  dailyQuestionLimit: number;

  bufferRate: number;

  instantThresholdSeconds: number;

  setupCompleted: boolean;

  createdAt: string;

  updatedAt: string;
}

export const createDefaultSetup =
  (): Setup => {
    const examDate = new Date();

    examDate.setDate(
      examDate.getDate() + 60,
    );

    return {
      name: "LinuC 101",

      examDate:
        examDate
          .toISOString()
          .split("T")[0],

      dailyNewLimit: 10,

      dailyQuestionLimit: 20,

      bufferRate: 20,

      instantThresholdSeconds: 30,

      setupCompleted: false,

      createdAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString(),
    };
  };