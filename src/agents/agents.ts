import type {
	OutputGuardrailResult,
	OutputGuardrailTripwireTriggered,
	OutputGuardrail,
} from "@openai/agents";
import { Agent, run } from "@openai/agents";
import { google } from "@ai-sdk/google";
import { aisdk } from "@openai/agents-extensions";
import { z } from "zod";

import { Quiz, Questions, Cloze } from "../schemas/schemas.js";

import {
	clozeGeneratorInstructions,
	questionsGeneratorInstructions,
} from "./systemInstructions.js";

const geminiModel = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const gemini = aisdk(google(geminiModel));

const questionsGenerator = new Agent({
	name: "Question Generator",
	instructions: questionsGeneratorInstructions,
	// model: gemini,
	outputType: Questions,
});

const questionsTool = questionsGenerator.asTool({
	toolName: "generate_questions",
	toolDescription: "Generate multiple choice questions based on a given text.",
});

const clozeGenerator = new Agent({
	name: "Cloze Generator",
	instructions: clozeGeneratorInstructions,
	// model: gemini,
	outputType: Cloze,
});

const clozeTool = clozeGenerator.asTool({
	toolName: "generate_cloze_exercise",
	toolDescription:
		"Generate a fill-in-the-blanks exercise, a cloze, from a given text.",
});

const clozeOutputGuardrailAgent = new Agent({
	name: "Cloze Check",
	instructions: `Check if the cloze exercise complies to the instructions. The cloze generator received these instructions: \n${clozeGeneratorInstructions}`,
	outputType: z.object({
		isValidCloze: z.boolean(),
		reasoning: z.string(),
	}),
});

const clozeOutputGuardrail: OutputGuardrail<typeof Quiz> = {
	name: "Cloze Output Check",
	execute: async ({ agentOutput, context }) => {
		const res = await run(
			clozeOutputGuardrailAgent,
			JSON.stringify(agentOutput.cloze),
			{ context },
		);

		return {
			outputInfo: res.finalOutput,
			tripwireTriggered: !res.finalOutput?.isValidCloze,
		};
	},
};

const quizGenerator = new Agent({
	name: "Quiz Generator",
	instructions:
		"You generate a quiz based on a given file. You must use your tools to generate it.",
	// model: gemini,
	tools: [questionsTool, clozeTool],
	outputType: Quiz,
	outputGuardrails: [clozeOutputGuardrail],
	modelSettings: { toolChoice: "required" },
});

export { quizGenerator };
