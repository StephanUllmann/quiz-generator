import mongoose from 'mongoose';

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

export default QuizForFile;
