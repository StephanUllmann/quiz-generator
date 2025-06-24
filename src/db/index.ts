import mongoose from "mongoose";

const connectionString = process.env.MONGO_URI;
if (!connectionString) {
	console.error("MongoDB Connection String missing");
	process.exit(1);
}

const mongodb = await mongoose.connect(connectionString, {
	dbName: "quizzes",
});
console.log(`Connected to DB: ${mongodb.connection.name}`);

const QuizForFileSchema = new mongoose.Schema<IQuizForFile>({
	path: String,
	sha: String,
	questions: {},
	cloze: {},
});

const QuizForFile = mongoose.model<IQuizForFile>("quiz", QuizForFileSchema);

export default QuizForFile;
export { QuizForFileSchema };
