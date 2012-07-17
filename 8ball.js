/**
 * @module 8ball
 */

const irc   = require( "irc-js" )
    , fmt   = require( "util" ).format

const responses =
  [ "It is certain"
  , "It is decidedly so"
  , "Without a doubt"
  , "Yes — definitely"
  , "You may rely on it"
  , "As I see it, yes"
  , "Most likely"
  , "Outlook good"
  , "Yes"
  , "Signs point to yes"
  , "Reply hazy, try again"
  , "Ask again later"
  , "Better not tell you now"
  , "Cannot predict now"
  , "Concentrate and ask again"
  , "Don’t count on it"
  , "My reply is no"
  , "My sources say no"
  , "Outlook not so good"
  , "Very doubtful"
  ]

const getFortune = function( msg ) {
  msg.reply( "%s, %s.", msg.from.nick
    , responses[ Math.floor( responses.length * Math.random() ) ] )
  return irc.STATUS.STOP
}

const load = function( client ) {
  client.lookFor( fmt( "^:%s\\b(.+)\\?\s*$", client.user.nick ), getFortune )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  return irc.STATUS.SUCCESS
}

exports.name  = "8ball"
exports.load  = load
exports.eject = eject