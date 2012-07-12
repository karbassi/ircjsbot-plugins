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

const logger = irc.logger.get( "ircjs" )
    , sKey   = "FACTOID"

var rc = null

const handleError = function( err ) {
  logger.error( "Factoid Redis client error: %s", err )
}

// Factoids.

// An object for good old bot-t, handy for checking its presence
const botT = irc.person( "bot-t" )
    , botTPrefix = "?"

const speak = function( msg, prefix, trigger, person ) {
  // Shut up if bot-t's prefix was used and bot-t is there
  if ( prefix === botTPrefix && irc.channel( msg.params[0] )
      .people.has( botT.id ) )
    return
  rc.hget( sKey, trigger, function( err, res ) {
    if ( err ) {
      logger.error( "Error hget:ing factoid: %s", err )
      return
    }
    if ( ! res )
      return
    msg.reply( "%s, %s", person || msg.from.nick, res )
  } )
}

const learn = function( bot, msg, key, value ) {
  logger.debug( "factoid learn `%s`", key )
  rc.hset( sKey, key, value, function( err, res ) {
    if ( err ) {
      logger.error( "learn factoid error: %s", err )
      return
    }
    logger.debug( "Learned a new factoid: %s", key )
    msg.reply( "%s, memorised “%s”.", msg.from.nick, key )
  } )
}

const forget = function( bot, msg, key ) {
  logger.debug( "factoid forget `%s`", key )
  rc.hdel( sKey, key, function( err, res ) {
    if ( err ) {
      logger.error( "forget factoid error: %s", err )
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
    logger.debug( "Happily forgot factoid: %s", key )
  } )
}

// Implement Plugin interface.

const load = function( bot ) {
  if ( rc )
    return irc.STATUS.SUCCESS

  rc = redis.createClient( PORT, HOST )
  rc.auth( TOKEN )
  rc.on( share.redis.EVENT.ERROR, handleError )

  bot.lookFor( /^:(?:[\/.,`?])([-_.:|\/\\\w]+) +is[:,]? +(.+)$/
    , learn.bind( null, bot ) )
  bot.lookFor( /^:(?:[\/.,`?])forget +([-_.:|\/\\\w]+)$/
    , forget.bind( null, bot ) )
  bot.lookFor( /^:([\/.,`?])?([-_.:|\/\\\w]+)(?: *@ *([-\[\]\{\}`|_\w]+))?\s*$/
    , speak )

  return irc.STATUS.SUCCESS
}

const eject = function() {
  if ( rc )
    rc.quit()
  return irc.STATUS.SUCCESS
}

exports.name  = "Factoid"
exports.load  = load
exports.eject = eject
