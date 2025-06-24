import { z } from "zod";

const Questions = z.object({
	questions: z.array(
		z.object({
			question: z.string(),
			choices: z.array(
				z.object({
					id: z.number(),
					text: z.string(),
				}),
			),
			answer: z.object({
				id: z.number(),
				text: z.string(),
			}),
		}),
	),
});

const Cloze = z.object({
	textWithBlanks: z.string(),
	redHerrings: z.array(z.string()),
});

const Quiz = z.object({
	questions: Questions,
	cloze: Cloze,
});

export { Quiz, Questions, Cloze };
