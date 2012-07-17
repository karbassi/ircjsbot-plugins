/**
 * @module factoid
 */

const redis = require( "redis" )
    , fmt   = require( "util" ).format
    , irc   = require( "irc-js" )
    , share = require( "./shared" )

const TOKEN = share.redis.TOKEN
    , HOST  = share.redis.HOST
    , PORT  = share.redis.PORT

const log   = irc.logger.get( "ircjs-plugin-factoid" )
    , sKey  = "FACTOID"

const handleError = function( err ) {
  log.error( "Factoid Redis client error: %s", err )
}

const redisClient = redis.createClient( PORT, HOST )
redisClient.auth( TOKEN )
redisClient.on( share.redis.EVENT.ERROR, handleError )



// Factoids.

// An object for good old bot-t, handy for checking its presence
const botT = irc.person( "bot-t" )
    , botTPrefix = "?"

const speak = function( client, msg, prefix, trigger, person ) {
  const isPM = msg.params[0] === client.user.nick
  // Shut up if bot-t's prefix was used and bot-t is there
  if ( !isPM && prefix === botTPrefix &&
        irc.channel( msg.params[0] ).people.has( botT.id ) )
    return
  redisClient.hget( sKey, trigger, function( err, res ) {
    if ( err ) {
      log.error( "Error hget:ing factoid: %s", err )
      return
    }
    if ( ! res )
      return
    msg.reply( "%s, %s", person || msg.from.nick, res )
  } )
}

const learn = function( msg, key, value ) {
  log.debug( "factoid learn `%s`", key )
  redisClient.hset( sKey, key, value, function( err, res ) {
    if ( err ) {
      log.error( "learn factoid error: %s", err )
      return
    }
    log.debug( "Learned a new factoid: %s", key )
    msg.reply( "%s, memorised “%s”.", msg.from.nick, key )
  } )
}

const forget = function( msg, key ) {
  log.debug( "factoid forget `%s`", key )
  redisClient.hdel( sKey, key, function( err, res ) {
    if ( err ) {
      log.error( "forget factoid error: %s", err )
      return
    }
    // Nothing was deleted
    if ( res === 0 ) {
      msg.reply( "%s, I can’t forget that which I do not know.", msg.from.nick )
      return
    }
    const replyText = fmt( "%s, I have forgotten “%s”%s"
      , msg.from.nick, key
      , Math.random() > 0.5 ? ". My mind is going, I can feel it." : "." )
    msg.reply( replyText )
    log.debug( "Happily forgot factoid: %s", key )
  } )
}

// Implement Plugin interface.

const load = function( client ) {
  client.lookFor( /^:(?:[\/.,`?])([-_.:|\/\\\w]+) +is[:,]? +(.+)$/
    , learn )
  client.lookFor( /^:(?:[\/.,`?])forget +([-_.:|\/\\\w]+)$/
    , forget )
  client.lookFor( /^:([\/.,`?])?([-_.:|\/\\\w]+)(?: *@ *([-\[\]\{\}`|_\w]+))?\s*$/
    , speak.bind( null, client ) )

  return irc.STATUS.SUCCESS
}

const eject = function() {
  return irc.STATUS.SUCCESS
}

exports.name  = "Factoid"
exports.load  = load
exports.eject = eject
