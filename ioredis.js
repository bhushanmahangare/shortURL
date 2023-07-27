const Redis = require('ioredis');

const redis = new Redis('redis://127.0.0.1:6380');

const insertRD = async (key, value) => {
  try {
    await redis.set(key, value);
    console.log('Data inserted successfully into Redis!');
  } catch (err) {
    console.error('Error inserting data into Redis:', err);
  }
};

const getRD = async (key) => {
    try {
      const a = await redis.get(key);
      console.log('Data inserted successfully into Redis!', a);
    } catch (err) {
      console.error('Error inserting data into Redis:', err);
    }
  };
  

// Example Usage
const key = 'www.google.com';
const value = 'Sonlwf';

// Insert data into Redis cache
insertRD(key, value);
getRD(key);