import type { z } from "zod";
import type { Request } from "express";
import type { Quiz, Questions, Cloze } from "./schemas/schemas.js";
import type { QuizForFileSchema } from "./db/index.js";
import type { InferRawDocType, Document } from "mongoose";

declare global {
	// type HttpError = Error & { cause: { status: number } };

	type QuestionsRequest = Request<{}, {}, { url: string }>;

	type QuizType = z.infer<typeof Quiz>;
	type QuestionsType = z.infer<typeof Questions>;
	type ClozeType = z.infer<typeof Cloze>;

	type QuizForFileType = InferRawDocType<typeof QuizForFileSchema>;

	interface IQuizForFile extends Document {
		path: string;
		sha: string;
		questions: QuestionsType["questions"];
		cloze: ClozeType;
	}

	interface GitHubFileContent {
		name: string;
		path: string;
		sha: string;
		size: number;
		url: string;
		html_url: string;
		git_url: string;
		download_url: string;
		type: string;
		content: string;
		encoding: string;
		_links: {
			self: string;
			git: string;
			html: string;
		};
	}
}
