const assert = require('assert')
const crypto = require('crypto')
const request = require('request-promise-native')
const qs = require('query-string')

module.exports = function(pg) {

  function encrypt_token(token) {
    let cipher = crypto.createCipher('aes192', process.env.ENCRYPTION_SECRET);
    let enc_token = cipher.update(Buffer.from(token, 'utf8'));
    enc_token = Buffer.concat([enc_token, cipher.final()]);
    return enc_token.toString('base64');
  }

  function decrypt_token(enc_token) {
    let deciph = crypto.createDecipher('aes192', process.env.ENCRYPTION_SECRET);
    let token = deciph.update(Buffer.from(enc_token, 'base64'), 'utf8');
    token += deciph.final('utf8');
    return token;
  }

  let token_cache = []
  setInterval(() => token_cache = [], 1000 * 60 * 15)

  async function remove_token(slack_user_id, slack_team_id) {
    token_cache[slack_user_id + slack_team_id] = null
    await pg.query(`delete from links where slack_user_id = $1 and slack_team_id = $2`, [slack_user_id, slack_team_id])
  }

  async function save_token(slack_user_id, slack_team_id, common_auth_tokens) {
    token_cache[slack_user_id + slack_team_id] = [{common_auth_tokens, updated:(new Date()).toString()}]
    await pg.query(`
      insert into links 
        (slack_user_id, slack_team_id, common_auth_tokens, updated) 
      values 
        ($1, $2, $3, now())
      on conflict (slack_user_id, slack_team_id) 
      do update set 
        common_auth_tokens = $3, 
        updated = now()
    `, [slack_user_id, slack_team_id,  encrypt_token(JSON.stringify(common_auth_tokens))])
  }

  async function token(slack_user_id, slack_team_id) {
    if (token_cache[slack_user_id + slack_team_id]) {
      return token_cache[slack_user_id + slack_team_id]
    }
    let data = await pg.query(`select common_auth_tokens, updated from links where slack_user_id = $1 and slack_team_id = $2`, [slack_user_id, slack_team_id])
    token_cache[slack_user_id + slack_team_id] = data.rows.map((x) => Object.assign(x, {common_auth_tokens:JSON.parse(decrypt_token(x.common_auth_tokens))}))
    return token_cache[slack_user_id + slack_team_id]
  }

  async function have_token(slack_user_id, slack_team_id) {
    let data = await token(slack_user_id, slack_team_id)
    if(data.length !== 1) {
      return false
    } 
    let tokens = data[0].common_auth_tokens
    let updated = new Date(data[0].updated)
    let expires = updated.getTime() + (tokens.expires_in * 1000)
    if(expires >= Date.now()) {
      return true
    }
    // we are expired, but we can get a new one via refresh tokens.
    try {
      await save_token(slack_user_id, slack_team_id, await oauth_exchange_refresh_token(tokens.refresh_token))
      return true
    } catch (e) {
      await remove_token(slack_user_id, slack_team_id)
      return false
    }
  }

  async function oauth_start_flow(req, res) {
    req.session.slack_team_id = req.params.slack_team_id
    req.session.slack_user_id = req.params.slack_user_id
    req.session.state = Math.floor(Math.random() * Math.pow(2,25)).toString()
    res.redirect(`${process.env.OAUTH2_AUTHORIZE_URL}?client_id=${process.env.OAUTH2_CLIENT_ID}&response_type=code&redirect_uri=${process.env.OAUTH2_REDIRECT_URI}&state=${req.session.state}`)
  }

  async function oauth_exchange_refresh_token(refresh_token) {
    let body = `grant_type=refresh_token&client_id=${process.env.OAUTH2_CLIENT_ID}&client_secret=${process.env.OAUTH2_CLIENT_SECRET}&refresh_token=${refresh_token}`
    let headers = {"accept":"*/*", "content-length":body.length, "content-type":"application/x-www-form-urlencoded", "user-agent":"victoriesbot"}
    let tokens = await request({method:"post", url:`${process.env.OAUTH2_TOKEN_URL}`, headers, body, json:true})
    assert.ok(tokens.refresh_token, 'A refresh token was not on the exchange.')
    assert.ok(tokens.access_token, 'An access token was not on the exchange.')
    assert.ok(tokens.expires_in, 'An expires stamp was not in the exchange.')
    return tokens
  }

  async function oauth_code_callback(req, res) {
    try {
      if(req.query.state !== req.session.state || !req.session.state || req.query.error || req.query.error_description) {
        return res.send("Sorry, something must have gone wrong.")
      }
      let body = `grant_type=authorization_code&client_id=${process.env.OAUTH2_CLIENT_ID}&client_secret=${process.env.OAUTH2_CLIENT_SECRET}&redirect_uri=${process.env.OAUTH2_REDIRECT_URI}&code=${req.query.code}`;
      let headers = {"accept":"*/*", "content-length":body.length, "content-type":"application/x-www-form-urlencoded", "user-agent":"victoriesbot"}
      let tokens = await request({method:"post", url:`${process.env.OAUTH2_TOKEN_URL}`, headers, body, json:true})
      assert.ok(tokens.refresh_token, 'A refresh token was not on the exchange.')
      assert.ok(tokens.access_token, 'An access token was not on the exchange.')
      assert.ok(tokens.expires_in, 'An expires stamp was not in the exchange.')
      await save_token(req.session.slack_user_id, req.session.slack_team_id, tokens)
      res.redirect('slack://open') // TODO, figure out a way to embed more deeply into the app?
    } catch (e) {
      console.error(e)
      res.status(503).send('There was an error that happened while trying to access your account.')
    }
  }

  async function slack_please_login(body) {
    if(!body || !body.team_id || !body.user_id) {
      throw new Error('The request did not make sense.')
    }
    return {
      "attachments": [
        {
          "fallback": `Please login by going to ${process.env.VANITY_URL}/teams/${body.team_id}/users/${body.user_id}/login`,
          "color": "#36a64f",
          "pretext": "Sorry, I cannot do that. You don't appear to be logged in.",
          "title": "Your App",
          "title_link": `${process.env.VANITY_URL}/teams/${body.team_id}/users/${body.user_id}/login`,
          "text": "Login to yourapp to link your slack and yourapp account. You'll only have to do this once.",
          "footer": "Your App",
          "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
          "ts": Date.now()
        }
      ]
    }
  }

  async function slack_is_signed(req) {
    const timestamp = req.headers["x-slack-request-timestamp"]
    const headerSignature = req.headers["x-slack-signature"]
    const hash = crypto
      .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
      .update(`v0:${timestamp}:${req.body.toString('utf8')}`)
      .digest("hex")
    const calculatedSignature = `v0=${hash}`
    req.body = qs.parse(req.body.toString('utf8'))
    return headerSignature === calculatedSignature
  }

  async function slack_validate(req, res, next) {
    if(!await slack_is_signed(req)) {
      res.status(401).send('Unauthorized')
    }
    if(!await have_token(req.body.user_id, req.body.team_id)) {
      // TODO: Save command to pick it up later using response_url?
      return res.json(await slack_please_login(req.body))
    } else {
      req.tokens = await token(req.body.user_id, req.body.team_id)
      next()
    }
  }

  return {
    save_token,
    token,
    have_token,
    oauth_start_flow,
    oauth_code_callback,
    slack_validate,
    slack_please_login
  }
}