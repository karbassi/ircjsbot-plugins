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
  , factoids = null

const handleError = function( err ) {
  logger.log( irc.LEVEL.ERROR, "Factoid Redis client error: %s", err )
}

// Factoids.

const speak = function( msg, prefix, trigger, person ) {
  if ( factoids[trigger] ) {
    if ( prefix == '?' && irc.channel( msg.params[0] ).people.has( irc.id( "bot-t" ) ) )
      return
    else
      msg.reply( fmt( "%s: %s", person || msg.from.nick, factoids[trigger] ) )
  }
}

const learn = function( bot, msg, key, value ) {
  forget( bot, msg, key )
  logger.log( irc.LEVEL.DEBUG, "factoid learn `%s`", key )
  rc.hmset( sKey, key, value, function( err ) {
    if ( err ) {
      logger.log( irc.LEVEL.ERROR, "learn factoid error: %s", err )
      return
    }
    else {
      factoids[key] = value
      msg.reply( fmt("%s: kk", msg.from.nick ) )
    }
  } )
}

const forget = function( bot, msg, key ) {
  logger.log( irc.LEVEL.DEBUG, "factoid forget `%s`", key )
  rc.hdel( sKey, key, function( err ) {
    if ( err ) {
      logger.log( irc.LEVEL.ERROR, "forget factoid error: %s", err )
      return
    }
    else
      delete factoids[key]
  } )
}

// Implement Plugin interface.

const load = function( bot ) {
  if ( rc )
    return irc.STATUS.SUCCESS

  rc = redis.createClient( PORT, HOST )
  rc.auth( TOKEN )
  rc.on( share.redis.EVENT.ERROR, handleError )

  rc.hgetall( sKey, function ( err, obj ) {
    var i
    if ( ! err )
      factoids = obj || {}
  } )

  bot.lookFor( /^:([-_.:|\/\\\w]+) +is[:,]? +(.+)$/,                               learn.bind( null, bot ) )
  bot.lookFor( /^:forget +([-_.:|\/\\\w]+)$/,                                      forget.bind( null, bot ) )
  bot.lookFor( /^:([\/.,`?])?([-_.:|\/\\\w]+)(?: *@ *([-\[\]\{\}`|_\w]+))?\s*$/, speak )

  return irc.STATUS.SUCCESS
}

const eject = function() {
  if ( rc )
    rc.quit()
  return irc.STATUS.SUCCESS
}

module.exports =
  { name:   "Factoid"
  , load:   load
  , eject:  eject
  }

