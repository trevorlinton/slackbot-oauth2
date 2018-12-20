/**
 * These are responsible for sending back responses from /slash_commands on slack,
 * these will only execute after they have been authorized as coming from slack,
 * and that the user has a token issued by the oauth2 systme, and has been parsed.
 *
 * See https://api.slack.com/slash-commands,
 * and https://api.slack.com/docs/message-attachments 
 * for what you should send back for content
 *
 * In the req object passed in req.body has a mapping of key=value pairs from the slack command,
 * in addition it has req.tokens of the users linked oauth2 system response
 */
module.exports = function(pg) {

  async function some_functionality(req, res) {
    res.json({
      "attachments": [
        {
          "fallback": `Some functionality`,
          "color": "#36a64f",
          "pretext": "Some other functionality",
          "title": "Some other functionality",
          "title_link": `https://asdf`,
          "text": "Some other functionality",
          "footer": "Your App",
          "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
          "ts": Date.now()
        }
      ]
    })
  }

  async function some_other_functionality(req, res) {
    res.json({
      "attachments": [
        {
          "fallback": `Some other functionality`,
          "color": "#36a64f",
          "pretext": "Some other functionality",
          "title": "Some other functionality",
          "title_link": `https://asdf`,
          "text": "Some other functionality",
          "footer": "Your App",
          "footer_icon": "https://platform.slack-edge.com/img/default_application_icon.png",
          "ts": Date.now()
        }
      ]
    })
  }

  return {
    some_functionality,
    some_other_functionality
  }
}
