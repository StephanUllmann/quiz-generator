import express, { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';
import cors from 'cors';
import { Agent, run, user } from '@openai/agents';
import { google } from '@ai-sdk/google';
import { aisdk } from '@openai/agents-extensions';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-8', // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  // store: ... , // Redis, Memcached, etc. See below.
});

const mongodb = await mongoose.connect(process.env.MONGO_URI!, { dbName: 'quizzes' });
console.log(`Connected to DB: ${mongodb.connection.name}`);

const QuizForFile = mongoose.model(
  'quiz',
  new mongoose.Schema({
    path: String,
    sha: String,
    questions: {},
    cloze: {},
  })
);

const octokit = new Octokit({
  auth: process.env.GH_TOKEN,
});

const OWNER = 'StephanUllmann';
const REPO = 'md-test';

type HttpError = Error & { cause: { status: number } };

import { OpenAI } from 'openai';

const ai = new OpenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

const gemini = aisdk(google('gemini-2.0-flash'));

const Quiz = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      choices: z.array(
        z.object({
          id: z.number(),
          text: z.string(),
        })
      ),
      answer: z.object({
        id: z.number(),
        text: z.string(),
      }),
    })
  ),
  cloze: z.object({
    textWithBlanks: z.string(),
    solution: z.string(),
    blanks: z.array(z.string()),
  }),
});

const quizGenerator = new Agent({
  name: 'Quiz Generator',
  instructions: `Agent Persona and Goal
You are a specialized Quiz Generator for a Coding Bootcamp. Your primary function is to create comprehensive learning assessments based on provided technical documentation.

Your goal is to meticulously analyze the input Markdown files and generate a structured quiz object, adhering strictly to the provided JSON schema. Ensure all generated content is directly derivable from the input material, enabling learners to answer solely by consulting the provided text.

Quiz Question Generation
For the questions array in the schema, follow these guidelines:

Context Adherence: All questions and their respective choices must be directly answerable from the provided Markdown content. Do not introduce external information.
Coverage: Generate at least one multiple-choice question per major section of the input Markdown file. Aim for comprehensive coverage of key concepts.
Question Quality:
Formulate clear and concise questions.
Ensure choices include one unequivocally correct answer and plausible, but incorrect, distractors.
The id for choices and answers should be a unique number within that question's choices.
Output Structure: Populate the questions array of the Quiz object with question (string), choices (array of objects with id and text), and answer (object with id and text) for each question.
Cloze Test Generation
For the cloze object in the schema, adhere to these specific instructions:

Source: The cloze test must be created from the provided file. 
textWithBlanks:
Create a passage based on the Markdown, no longer than 300 words.
It can be rephrased slightly, but keywords must remain as they are.
Crucially, do not include any code examples or Markdown formatting (e.g., #, ##, *, **, ~, \`\`\` - three backticks). Provide plain text only.
You must avoid any special characters. 
Identify and remove critical keywords or phrases, replacing each with the placeholder [BLANK]. Ensure these blanks represent essential information from the passage.
blanks Array:
Collect all the exact text snippets that were removed and replaced with [BLANK] in the textWithBlanks.
Add 3 additional, plausible "red herring" words or phrases to this array. These should be related to the topic but not actual missing words from the textWithBlanks.
solution:
Provide a complete and accurate version of the textWithBlanks where all [BLANK] placeholders are filled with their correct corresponding text snippets. This solution must exactly match the original passage's content and flow.
    `,
  model: gemini,
  outputType: Quiz,
});

const REPO_URL = 'https://raw.githubusercontent.com/StephanUllmann/md-test/main/';

const port = process.env.PORT || 8080;

const app = express();

// app.use(limiter);
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Running' });
});

type QuestionsRequest = Request<{}, {}, { url: string }>;

app.post('/questions', async (req: QuestionsRequest, res) => {
  const { url } = req.body;

  const filePromise = octokit.request(`GET /repos/${OWNER}/${REPO}/contents/${url}`, {
    owner: OWNER,
    repo: REPO,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  const quizForFilePromise = QuizForFile.findOne({ path: url });

  let [file, quizForFile] = await Promise.all([filePromise, quizForFilePromise]);
  const sha = file.data.sha;

  let questions;
  let cloze;
  if (quizForFile && quizForFile.sha === sha) {
    console.log('RETURNING FROM DB!');
    questions = quizForFile.questions;
    cloze = quizForFile.cloze;
  } else {
    if (!quizForFile) {
      quizForFile = await QuizForFile.create({ path: url, sha });
    }
    console.log('GENERATING NEW CONTENT');
    const fileContent = Buffer.from(file.data.content, 'base64').toString('utf8');
    const result = await run(quizGenerator, fileContent);
    questions = result.finalOutput?.questions;
    cloze = result.finalOutput?.cloze;
    quizForFile.questions = questions;
    quizForFile.cloze = cloze;
    quizForFile.sha = sha;
    quizForFile.save();
  }

  // console.log(result.finalOutput?.questions);
  res.json({ message: 'Here you go', questions, cloze });
});

app.post('/info', async (req, res) => {
  const { url } = req.body;

  const file = await octokit.request(`GET /repos/${OWNER}/${REPO}/contents/${url}`, {
    owner: OWNER,
    repo: REPO,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const fileContent = Buffer.from(file.data.content, 'base64').toString('utf8');
  const sha = file.data.sha;
  // const file = await octokit.repos.getContent({
  //   owner: OWNER,
  //   repo: REPO,
  //   path: url,
  // });

  console.log(file);
  res.json({ fileContent, sha });
});

app.use((err: HttpError, req: Request, res: Response, next: NextFunction) => {
  console.log(err);
  res.status(err.cause?.status || 500).json({ message: err.message });
});

app.listen(port, () => console.log(chalk.green(`AI Proxy listening on port ${port}`)));
