import { Request } from 'express';

declare global {
  type HttpError = Error & { cause: { status: number } };

  type QuestionsRequest = Request<{}, {}, { url: string }>;
}
