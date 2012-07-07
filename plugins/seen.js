/** @module seen
 */

const redis = require( "redis" )
    , fmt   = require( "util" ).format
    , irc   = require( "irc-js" )
    , share = require( "./shared" )

const TOKEN = share.redis.TOKEN
    , HOST  = share.redis.HOST
    , PORT  = share.redis.PORT

const getKey = function( id ) {
  return share.redis.key( id, "SEEN" )
}

const logger = irc.logger.get( "ircjs" )

var seenInstance = null

const Seen = function( bot ) {
  if ( seenInstance )
    return seenInstance
  seenInstance = this
  this.client = redis.createClient( PORT, HOST )
  this.bot = bot

  this.client.auth( TOKEN )
  this.client.on( share.redis.EVENT.ERROR, this.error.bind( this ) )
}

Seen.prototype.error = function( err ) {
  logger.log( irc.LEVEL.ERROR, "Seen Redis client error: %s", err )
}

Seen.prototype.seen = function( msg, name, num ) {
  const key = getKey( irc.id( name ) )
      // Bonus feature: ask for log entry at specific index
      , ix  = num || 0
  if ( msg.from.nick === name )
    return msg.reply( fmt( "%s, I see you right now, here in %s.", msg.from.nick
                         , this.bot.user.nick === msg.params[0] ? "our cozy private chat" : msg.params[0] ) )
  if ( this.bot.user.nick === name )
    return msg.reply( fmt( "%s, I am here with you in %s.", msg.from.nick
                         , this.bot.user.nick === msg.params[0] ? "our sexy private chat" : msg.params[0] ) )
  this.client.lindex( key, ix, this.reply.bind( this, msg, name ) )
}

Seen.prototype.reply = function( msg, name, err, res ) {
  logger.log( irc.LEVEL.DEBUG, "Replying to `seen` inquiry" )
  if ( err ) {
    msg.reply( fmt( "%s, I went to see, but there was an error: %s", err ) )
    logger.log( irc.LEVEL.DEBUG, "`seen` failed: %s", err )
    return
  }
  if ( ! res ) {
    msg.reply( fmt( "%s, no.", msg.from.nick ) )
    logger.log( irc.LEVEL.DEBUG, "Did not find any entries for %s", name )
    return
  }
  const parts = res.match( /^(\d+)(.+)/ )
      , date  = new Date( Number( parts[1] ) )
      , mesg  = irc.parser.message( parts[2] + "\r\n" )
      , ago   = share.timeAgo( date )
  if ( ! mesg )
    return msg.reply( fmt( "%s, WTF, could not parse this: %s", msg.from.nick, parts[2] ) )

  var reply = fmt( "%s, I saw %s %s ago", msg.from.nick, name, ago )
  switch ( mesg.type ) {
    case irc.COMMAND.PRIVMSG:
      if ( irc.parser.channel( mesg.params[0] ) === null )
        reply += ", saying something to me in private"
      else
        reply += fmt( ", %s %s, saying “%s”", msg.params[0] === mesg.params[0] ? "here in" : "in"
                    , mesg.params[0], mesg.params[1].slice( 1 ) )
      break
    case irc.COMMAND.JOIN:
      reply += fmt( ", joining %s", mesg.params[0] )
      break
    case irc.COMMAND.PART:
      reply += fmt( ", leaving %s%s", mesg.params[0]
                  , mesg.params[1] ? " with the message “%s”" + mesg.params[1].slice( 1 ) : "." )
      break
    case irc.COMMAND.QUIT:
      reply += fmt( ", quitting with the message “%s”", mesg.params[0].slice( 1 ) )
      break
    case irc.COMMAND.NICK:
      name = mesg.params[0]
      reply += fmt( ", changing nick to %s", name )
      break
    default:
      logger.log( irc.LEVEL.DEBUG, mesg, mesg.type )
      reply += ", doing something I have no description for. The message was: " + parts[2]
      break
  }

  msg.reply( reply + "." )
  logger.log( irc.LEVEL.DEBUG, "Found stuff for %s, replied: %s", name, reply )
}

Seen.prototype.store = function( msg ) {
  if ( ! ( msg.from instanceof irc.Person ) )
    return
  const key = getKey( msg.from.id )
      , val = Number( msg.date ) + msg
  this.client.lpush( key, val )
}

// Implement Plugin interface.

const load = function( bot ) {
  const s = new Seen( bot )
      , n = bot.user.nick
  bot.observe( irc.EVENT.ANY
             , s.store.bind( s ) )
  bot.lookFor( fmt( "\\b%s\\b.*seen? +([-`_\\{\\}\\[\\]\\^\\|\\\\a-z0-9]+)(?: +(\\d+))?", n )
             , s.seen.bind( s ) )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  if ( seenInstance )
    seenInstance.client.quit()
  seenInstance = null
  return irc.STATUS.SUCCESS
}

module.exports =
  { name:   "Seen"
  , load:   load
  , eject:  eject
  }
