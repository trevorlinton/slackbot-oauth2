const express = require('express')
const session = require('express-session')
const fs = require('fs')
const { Pool } = require('pg')

const pg = new Pool({connectionString:process.env.DATABASE_URL})
pg.on('error', (e) => console.error(e))
pg.query(fs.readFileSync('./create.sql').toString('utf8')).catch((err) => console.error(err))

const auth = require('./auth.js')(pg)
const logic = require('./businesslogic.js')(pg)

const port = process.env.PORT || 9000
const app = express()
app.use(session({
  "store":new (require('connect-pg-simple')(session))({pool:pg}),
  "secret":process.env.SESSION_COOKIE_SECRET,
  "resave":false,
  "saveUninitialized":true,
  "cookie": { "maxAge": 30 * 24 * 60 * 60 * 1000 }
}))
app.use (function(req, res, next) {
  req.body = Buffer.alloc(0)
  req.on('data', (chunk) => req.body = Buffer.concat([req.body, chunk]));
  req.on('end', () => next());
});
app.get('/teams/:slack_team_id/users/:slack_user_id/login', auth.oauth_start_flow)
app.get('/auth/callback', auth.oauth_code_callback)
app.post('/some_functionality', auth.slack_validate, logic.some_functionality)
app.post('/some_other_functionality', auth.slack_validate, logic.some_other_functionality)
app.listen(port, () => console.log(`Express is running on ${port}.`))