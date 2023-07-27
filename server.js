const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const Redis = require('ioredis');
const redis = new Redis('redis://127.0.0.1:6380');
const app = express();

const connection = require('./db');
const logger = require('./logger');

app.listen(3000, () => {
  logger.info('Server started and listening on port 3000');
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.'
});


//Routes
app.get('/shorten',
  apiLimiter,
  async (req, res) => {
    const url = req.query.url;
    logger.info('Inserted URL :: ' + url);

    if (validateUrl(url)) {
      try {
        const ifPresent = await getRD(url);
        let shortURL1;

        if (!ifPresent) {
          shortURL1 = generateShortURL(url);

          logger.info(`Short URL: ${url} maps to Long URL: ${shortURL1}`);

          await insertRD(url, shortURL1);
        }
        else {
          shortURL1 = ifPresent;
        }

        res.send(`http://localhost:3000/${shortURL1}`);

      } catch (error) {
        logger.error("Error processing short URL:", error);

        res.status(500).send("Internal Server Error");
      }
    }
    else {
      res.status(400).send('Invalid Original Url');
    }
  });


app.get('/:shortUrl', apiLimiter, async (req, res) => {
  const shortUrl = req.params.shortUrl;
  logger.info("Inserted ShortURL ", shortUrl);

  try {
    const ifPresent = await getRD(shortUrl);
    logger.info("Check ShortURL present in Redis cache ", ifPresent);

    if (!ifPresent) {
      const longURL = await fetchData(shortUrl);

      logger.info("Data Fetch ", longURL);

      logger.info("check ShortURL present in Mysql DB", longURL);
      if (longURL) {
        res.redirect(longURL);
      } else {
        res.sendStatus(404);
      }
    } else {
      const longURL = ifPresent;

      logger.info("Fetch Long URL " + longURL);
      res.redirect(longURL);
    }
  } catch (error) {
    logger.error("Error fetching URL:", error);
    res.sendStatus(500);
  }
});



//URL Shortening Algorithm
base62Chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
shortUrlLength = 6;

function generateShortURL(longURL) {
  const hash = crypto.createHash('sha1').update(longURL).digest('hex');

  logger.info(" Hash String " + hash);

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
const insertData = (longURL, shortURL) => {
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


//Redis Cache Insert & Get 
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


const validateUrl = (value) => {
  var urlPattern = new RegExp('^(https?:\\/\\/)?' + // validate protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // validate domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // validate OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // validate port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // validate query string
    '(\\#[-a-z\\d_]*)?$', 'i');

  return !!urlPattern.test(value);
}