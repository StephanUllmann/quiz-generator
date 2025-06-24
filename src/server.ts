import express from "express";
import type { Request, Response, NextFunction } from "express";
import type { OctokitResponse } from "@octokit/types";
import { RequestError } from "@octokit/request-error";
import chalk from "chalk";
import cors from "cors";
import { OutputGuardrailTripwireTriggered, run, user } from "@openai/agents";
import { quizGenerator } from "./agents/index.js";

import QuizForFile, { QuizForFileSchema } from "./db/index.js";
import { HttpError, octokit, OWNER, REPO } from "./utils/index.js";

const port = process.env.PORT || 8080;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
	res.json({ message: "Running" });
});

app.post("/questions", async (req: QuestionsRequest, res) => {
	const { url } = req.body;

	const filePromise = octokit.request(
		`GET /repos/${OWNER}/${REPO}/contents/${url}`,
		{
			owner: OWNER,
			repo: REPO,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);

	const quizForFilePromise = QuizForFile.findOne({ path: url });

	let file: OctokitResponse<GitHubFileContent, number>;
	let quizForFile: IQuizForFile | null;
	try {
		[file, quizForFile] = await Promise.all([filePromise, quizForFilePromise]);
	} catch (error) {
		console.log(error);
		if (error instanceof RequestError && error.status === 404)
			throw new HttpError(`File not found on path: ${url}`, { status: 404 });
		throw error;
	}

	const sha = file.data.sha;

	let questions: QuestionsType["questions"];
	let cloze: ClozeType;
	if (quizForFile && quizForFile.sha === sha) {
		console.log("RETURNING FROM DB!");
		questions = quizForFile.questions;
		cloze = quizForFile.cloze;
	} else {
		console.log("GENERATING NEW CONTENT");
		const fileContent = Buffer.from(file.data.content, "base64").toString(
			"utf8",
		);

		//
		// let result: Awaited<ReturnType<typeof run>>;
		let result: any;
		try {
			result = await run(quizGenerator, fileContent);
		} catch (error) {
			if (error instanceof OutputGuardrailTripwireTriggered) {
				res.status(500).json({ error: "Cloze Generation failed. Try again" });
				return;
			}
			throw Error("Quiz Generation failed");
		}
		//

		if (!quizForFile) {
			quizForFile = await QuizForFile.create({ path: url, sha });
		}
		questions = result.finalOutput?.questions
			.questions as QuestionsType["questions"];
		cloze = result.finalOutput?.cloze as ClozeType;
		quizForFile.questions = questions;
		quizForFile.cloze = cloze;
		quizForFile.sha = sha;
		quizForFile.save();
	}

	res.json({ message: "Here you go", questions, cloze });
});

app.post("/info", async (req, res) => {
	const { url } = req.body;

	const file = await octokit.request(
		`GET /repos/${OWNER}/${REPO}/contents/${url}`,
		{
			owner: OWNER,
			repo: REPO,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);
	const fileContent = Buffer.from(file.data.content, "base64").toString("utf8");
	const sha = file.data.sha;

	res.json({ fileContent, sha });
});

app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
	console.log(err);
	res.status(err.cause.status || 500).json({ message: err.message });
});

app.listen(port, () =>
	console.log(chalk.green(`AI Proxy listening on port ${port}`)),
);
