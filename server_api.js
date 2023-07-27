const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const Redis = require('ioredis');
const redis = new Redis('redis://127.0.0.1:6380');
const app = express();

const connection = require('./db');
const logger = require('./logger');

app.use(express.json());

app.listen(3000, () => {
  logger.info(`Server started and listening on port 3000`);
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per 15 minutes
    message: 'Too many requests from this IP, please try again later.'
  });
  

app.post('/api/shorten', apiLimiter, async (req, res) => {
  try {
    const { longUrl } = req.body;
    const shortUrl = generateShortURL();
    await insertRD(shortUrl, longUrl);
    const shortUrlResponse = `https://short.com/${shortUrl}`;
    logger.info(`Short URL generated for ${longUrl}: ${shortUrlResponse}`);
    res.json({ shortUrl: shortUrlResponse });
  } catch (error) {
    logger.error('Error while shortening URL:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/redirect/:shortUrl', apiLimiter,  async (req, res) => {
    try {
      const { shortUrl } = req.params;
      const longUrl = await getRD(shortUrl);
      if (longUrl) {
        logger.info(`Redirected to long URL for ${shortUrl}: ${longUrl}`);
        res.redirect(longUrl);
      } else {
        logger.error(`Short URL not found: ${shortUrl}`);
        res.status(404).send('Not Found');
      }
    } catch (error) {
      logger.error('Error while redirecting:', error);
      res.status(500).send('Internal Server Error');
    }
});


//URL Shortening Algorithm
base62Chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
shortUrlLength = 6;

function generateShortURL(longURL) {
    const hash = crypto.createHash('sha1').update(longURL).digest('hex');
    
    logger.info(" Hash String "+hash);
    
    let shortURL = '';
    for (let i = 0; i < shortUrlLength; i++) {
      const hashSubstr = hash.substring(i * 5, i * 5 + 5);
      const num = parseInt(hashSubstr, 16);
      shortURL += base62Chars[num % 62];
    }
    insertData(longURL, shortURL);
    
    return shortURL;
}


//Mysql 
const insertData = (longURL,shortURL) => {
  const data = { url: longURL, shortURL: shortURL };

  logger.info(data);

  connection.query('INSERT INTO URL SET ?', data, (err, result) => {
    if (err) {
      logger.info('Error inserting data:', err);
      return;
    }
    logger.info('Data inserted successfully!');
  });
};

const fetchData = (shortURL) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT url FROM URL WHERE shortURL = ? LIMIT 1';
    const params = [shortURL];
    
    connection.query(query, params, (err, rows) => {
      if (err) {
        logger.error('Error fetching data:', err);
        reject(err);
      } else {
        logger.info('Fetched data:', rows);
        if (rows.length > 0) {
          resolve(rows[0].url);
        } else {
          resolve(null);
        }
      }
    });
  });
};


const insertRD = async (key, value) => {
  try {
    await redis.set(key, value);
    logger.info('Data inserted successfully into Redis!');
    return true;
  } catch (err) {
    logger.error('Error inserting data into Redis:', err);
    return false;
  }
};

const getRD = async (key) => {
  try {
    const data = await redis.get(key);
    logger.info('Data fetech successfully', data);
    return data;
  } catch (err) {
    logger.error('Error fetch data into Redis:', err);
    return false;
  }
};