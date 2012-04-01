/** @module seen
 */

const redis = require( "redis" )
    , fmt   = require( "util" ).format
    , cnst  = require( "../node_modules/irc/lib/constants" )
    , obj   = require( "../node_modules/irc/lib/objects" )
    , parse = require( "../node_modules/irc/lib/parser" )
    , log   = require( "../node_modules/irc/lib/logger" )
    , shrd  = require( "./shared" )

const logger = log.get( "ircjs" )

const TOKEN = shrd.redis.TOKEN
    , HOST  = shrd.redis.HOST
    , PORT  = shrd.redis.PORT

// Redis events
const REDIS =
    { ERROR: "error"
    }

const getKey = function( id ) {
  return shrd.redis.key( id, "SEEN" )
}

const Seen = function( irc ) {
  const rclient = redis.createClient( PORT, HOST )
  rclient.auth( TOKEN )
  this.client = rclient
  this.irc = irc

  this.client.on( REDIS.ERROR, this.error.bind( this ) )
}

Seen.prototype.error = function( err ) {
  logger.log( log.LEVEL.ERROR, "Seen Redis client error: %s", err )
}

Seen.prototype.seen = function( msg, name, num ) {
  const key = getKey( new obj.Person( name, null, null ).id ) // >_>
      , ix  = num || 0 // Bonus feature
  if ( msg.from.nick === name )
    return msg.reply( fmt( "%s, I see you right now, here in %s.", msg.from.nick
                         , this.irc.user.nick === msg.params[0] ? "our cozy private chat" : msg.params[0] ) )
  if ( this.irc.user.nick === name )
    return msg.reply( fmt( "%s, I am here with you in %s.", msg.from.nick
                         , this.irc.user.nick === msg.params[0] ? "our sexy private chat" : msg.params[0] ) )
  this.client.lindex( key, ix, this.reply.bind( this, msg, name ) )
}

Seen.prototype.reply = function( msg, name, err, res ) {
  logger.log( log.LEVEL.DEBUG, "Replying to `seen` inquiry" )
  if ( err ) {
    msg.reply( fmt( "%s, I went to see, but there was an error: %s", err ) )
    logger.log( log.LEVEL.DEBUG, "`seen` failed: %s", err )
    return
  }
  if ( ! res ) {
    msg.reply( fmt( "%s, sorry, I have never seen %s.", msg.from.nick, name ) )
    logger.log( log.LEVEL.DEBUG, "Did not find any entries for %s", name )
    return
  }
  const parts = res.match( /^(\d+)(.+)/ )
      , date  = new Date( Number( parts[1] ) )
      , mesg  = parse.message( parts[2] + "\r\n" )
      , ago   = shrd.timeAgo( date )
  if ( ! mesg )
    return msg.reply( fmt( "%s, WTF, could not parse this: %s", msg.from.nick, parts[2] ) )

  var reply = fmt( "%s, I last saw %s %s ago", msg.from.nick, name, ago )
  switch ( mesg.type ) {
    case cnst.COMMAND.PRIVMSG:
      if ( parse.channel( mesg.params[0] ) === null )
        reply += ", saying something to me in private"
      else
        reply += fmt( ", %s %s, saying “%s”", msg.params[0] === mesg.params[0] ? "here in" : "in"
                    , mesg.params[0], mesg.params[1].slice( 1 ) )
      break
    case cnst.COMMAND.JOIN:
      reply += fmt( ", joining %s", mesg.params[0] )
      break
    case cnst.COMMAND.PART:
      reply += fmt( ", leaving %s%s", mesg.params[0]
                  , mesg.params[1] ? " with the message “%s”" + mesg.params[1].slice( 1 ) : "." )
      break
    case cnst.COMMAND.QUIT:
      reply += fmt( ", quitting with the message “%s”", mesg.params[0].slice( 1 ) )
      break
    case cnst.COMMAND.NICK:
      name = mesg.params[0]
      reply += fmt( ", changing nick to %s", name )
      break
    default:
      reply += ", doing something I have no description for. The message was: " + parts[2]
      break
  }
  reply += "."
  if ( this.irc.channels.contains( msg.params[0] )
      && this.irc.channels.get( msg.params[0] ).people.contains( name ) )
    reply += fmt( " %s is here right now.", name )

  else if ( this.irc.channels.contains( mesg.params[0] )
      && this.irc.channels.get( mesg.params[0] ).people.contains( name ) )
    reply += fmt( " %s is there right now.", name )

  msg.reply( reply )
  logger.log( log.LEVEL.DEBUG, "Found stuff for %s, replied: %s", name, reply )
}

Seen.prototype.log = function( msg ) {
  if ( ! ( msg.from instanceof obj.Person ) )
    return
  const key = getKey( msg.from.id )
      , val = Number( msg.date ) + msg
  this.client.lpush( key, val )
  logger.log( log.LEVEL.DEBUG, "Pushed message into Redis (maybe)" )
}

Seen.prototype.disconnect = function( msg ) {
  logger.log( log.LEVEL.INFO, "Telling seen.js redis client to quit" )
  this.client.quit()
}

const register = function( irc ) {
  const s = new Seen( irc )
      , n = irc.user.nick
  irc.observe( cnst.EVENT.ANY
             , s.log.bind( s ) )
  irc.observe( cnst.EVENT.DISCONNECT
             , s.disconnect.bind( s ) )
  irc.lookFor( fmt( "\\b%s\\b.*seen? +([-`_\\{\\}\\[\\]\\^\\|\\\\a-z0-9]+)(?: +(\\d+))?", n )
             , s.seen.bind( s ) )
  logger.log( log.LEVEL.INFO, "Registered Seen plugin" )
  return "Hooray"
}

exports.register = register
