// #10 Year in review: an editor's note written from the year's numbers
import { handler } from "./_lib/http.js";
import { askJSON, httpError } from "./_lib/claude.js";
import { TERMS } from "./_lib/style.js";

export default handler(async ({ year, stats }) => {
  if (!stats) throw httpError(400, "No stats");
  const { data } = await askJSON({
    system: `You write the editor's letter for a reader's own year in clothes, in the voice of a thoughtful fashion editor: warm, precise, unsentimental, never salesy.
Do not encourage buying. Celebrate wear, care and restraint. Be specific: use the names and numbers you are given.
${TERMS}`,
    prompt: `Year: ${year}
Numbers: ${JSON.stringify(stats).slice(0, 6000)}
Return {"headline":"a short headline for the year, max 8 words",
"letter":"about 110 words, two short paragraphs",
"resolution":"one concrete, wear-focused resolution for next year, one sentence"}`,
    maxTokens: 700,
    fast: true,
  });
  return data;
});
