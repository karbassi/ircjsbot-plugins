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

const log = irc.logger.get( "ircjs-plugin-seen" )

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
  log.error( "Seen Redis client error: %s", err )
}

Seen.prototype.seen = function( msg, name, num ) {
  const key = getKey( irc.id( name ) )
      // Bonus feature: ask for log entry at specific index
      , ix  = num || 0
  if ( msg.from.nick === name )
    msg.reply( "%s, I see you right now, here in %s.", msg.from.nick
             , this.bot.user.nick === msg.params[0] ? "our cozy private chat" : msg.params[0] )
  else if ( this.bot.user.nick === name )
    msg.reply( "%s, I am here with you in %s.", msg.from.nick
             , this.bot.user.nick === msg.params[0] ? "our sexy private chat" : msg.params[0] )
  else
    this.client.lindex( key, ix, this.reply.bind( this, msg, name ) )
  return irc.STATUS.STOP
}

Seen.prototype.reply = function( msg, name, err, res ) {
  log.debug( "Replying to `seen` inquiry" )
  if ( err ) {
    msg.reply( "%s, I went to see, but there was an error: %s", msg.from.nick, err )
    log.debug( "`seen` failed: %s", err )
    return
  }
  if ( ! res ) {
    msg.reply( "%s, I have never seen %s.", msg.from.nick, name )
    log.debug( "Did not find any entries for %s", name )
    return
  }
  const parts = res.match( /^(\d+)(.+)/ )
      , date  = new Date( Number( parts[1] ) )
      , mesg  = irc.parser.message( parts[2] + "\r\n" )
      , ago   = share.timeAgo( date )
  if ( ! mesg )
    return msg.reply( "%s, WTF, could not parse this: %s", msg.from.nick, parts[2] )

  var reply = fmt( "%s, I saw %s %s ago", msg.from.nick, name, ago )
  switch ( mesg.type ) {
    case irc.COMMAND.PRIVMSG:
      if ( irc.parser.channel( mesg.params[0] ) === null )
        reply += ", saying something to me in private."
      else
        reply += fmt( ", %s %s, saying: %s", msg.params[0] === mesg.params[0] ? "here in" : "in"
                    , mesg.params[0], mesg.params[1].slice( 1 ) )
      break
    case irc.COMMAND.JOIN:
      reply += fmt( ", joining %s.", mesg.params[0] )
      break
    case irc.COMMAND.PART:
      reply += fmt( ", leaving %s%s", mesg.params[0]
                  , mesg.params[1] ? " with the message: %s" + mesg.params[1].slice( 1 ) : "." )
      break
    case irc.COMMAND.QUIT:
      reply += fmt( ", quitting with the message: %s", mesg.params[0].slice( 1 ) )
      break
    case irc.COMMAND.NICK:
      name = mesg.params[0]
      reply += fmt( ", changing nick to %s.", name )
      break
    default:
      log.debug( mesg, mesg.type )
      reply += ", doing something I have no description for. The message was: " + parts[2]
      break
  }

  msg.reply( reply )
  log.debug( "Found stuff for %s, replied: %s", name, reply )
  return irc.STATUS.STOP
}

Seen.prototype.store = function( msg ) {
  if ( ! ( msg.from instanceof irc.Person ) )
    return
  const key = getKey( msg.from.id )
      , val = Number( msg.date ) + msg
  this.client.lpush( key, val )
}

// Implement Plugin interface.

const load = function( client ) {
  const s = new Seen( client )
  client.observe( irc.EVENT.ANY, s.store.bind( s ) )
  client.lookFor( fmt( "^:(?:\\b%s\\b[\\s,:]+|[@!\\/?\\.])seen +([-`_\\{\\}\\[\\]\\^\\|\\\\a-z0-9]+)(?: +(\\d+))?"
                     , client.user.nick )
                , s.seen.bind( s ) )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  if ( seenInstance )
    seenInstance.client.quit()
  seenInstance = null
  return irc.STATUS.SUCCESS
}

exports.name  = "Seen"
exports.load  = load
exports.eject = eject
