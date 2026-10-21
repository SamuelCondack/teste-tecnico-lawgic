import mongoose from 'mongoose';

export async function connectMongo(uri) {
  mongoose.set('strictQuery', true);

  let lastError;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      return;
    } catch (error) {
      lastError = error;
      console.log(`Mongo indisponível (tentativa ${attempt}/20). Nova tentativa em 1s.`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}
