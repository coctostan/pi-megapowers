export interface ToolCallRecord {
  tool: string;
  args: Record<string, any>;
  output?: string;
}

export interface TddComplianceReport {
  testWrittenFirst: boolean;
  testRanBeforeProduction: boolean;
  productionFilesBeforeTest: string[];
  testRunCount: number;
}

const TEST_FILE_PATTERNS = [/\.test\.[jt]s$/i, /\.spec\.[jt]s$/i, /(^|\/)tests\//i];
const PROD_FILE_PATTERN = /\.(ts|js)$/i;
const CONFIG_FILES = new Set(["package.json", "tsconfig.json", ".gitignore"]);
const WRITE_TOOLS = new Set(["write", "edit"]);
const TEST_COMMAND_PATTERNS = [
  /\bbun\s+test\b/i,
  /\bnpm\s+test\b/i,
  /\bpnpm\s+test\b/i,
  /\byarn\s+test\b/i,
  /\bnpx?\s+(jest|vitest|mocha)\b/i,
];

function isTestFile(p: string): boolean {
  return TEST_FILE_PATTERNS.some((re) => re.test(p));
}

function isConfigFile(p: string): boolean {
  return CONFIG_FILES.has(p);
}

function isProdFile(p: string): boolean {
  return PROD_FILE_PATTERN.test(p) && !isTestFile(p);
}

function isTestCommand(cmd: string): boolean {
  return TEST_COMMAND_PATTERNS.some((re) => re.test(cmd));
}

export function auditTddCompliance(toolCalls: ToolCallRecord[]): TddComplianceReport {
  const productionFilesBeforeTest: string[] = [];
  let firstTestWriteIdx: number | null = null;
  let firstProdWriteIdx: number | null = null;
  let firstTestRunIdx: number | null = null;
  let testRunCount = 0;

  toolCalls.forEach((c, idx) => {
    if (WRITE_TOOLS.has(c.tool)) {
      const p = c.args?.path;
      if (typeof p !== "string") return;
      if (isConfigFile(p)) return;
      if (isTestFile(p)) {
        if (firstTestWriteIdx === null) firstTestWriteIdx = idx;
        return;
      }
      if (isProdFile(p)) {
        if (firstProdWriteIdx === null) firstProdWriteIdx = idx;
        if (firstTestWriteIdx === null) productionFilesBeforeTest.push(p);
      }
      return;
    }
    if (c.tool === "bash") {
      const cmd = c.args?.command;
      if (typeof cmd !== "string") return;
      if (!isTestCommand(cmd)) return;
      testRunCount++;
      if (firstTestRunIdx === null) firstTestRunIdx = idx;
    }
  });

  const testWrittenFirst = productionFilesBeforeTest.length === 0;
  const testRanBeforeProduction =
    firstProdWriteIdx === null || (firstTestRunIdx !== null && firstTestRunIdx < firstProdWriteIdx);

  return { testWrittenFirst, testRanBeforeProduction, productionFilesBeforeTest, testRunCount };
}
