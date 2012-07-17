const redis = require( "redis" )
    , fmt   = require( "util" ).format
    , https = require( "https" )
    , irc   = require( "irc-js" )
    , share = require( "./shared" )

const TOKEN = share.redis.TOKEN
    , HOST  = share.redis.HOST
    , PORT  = share.redis.PORT

const logger = irc.logger.get( "ircjs" )
    , sKey   = "WAT"

var rc = null

const handleError = function( err ) {
  logger.error( "Wat Redis client error: %s", err )
}

// Go get the latest JSON
const getJson = function() {
  https.get( { host: "raw.github.com", path: "/gf3/WAT/master/wat.json" }
    , function( res ) {
        const data = []
        res.on( irc.NODE.SOCKET.EVENT.DATA, function( d ) {
          data.push( d )
        } )
        res.on( irc.NODE.SOCKET.EVENT.END, function() {
          const arr = JSON.parse( data.join( '' ) )
          logger.debug( "Got wat JSON: %s thingies", arr.length )
          rc.sadd( sKey, arr )
        } )
  } )
}

const onWat = function( msg ) {
  logger.debug( "onWat triggered" )
  rc.srandmember( sKey, function( err, res ) {
    if ( err ) {
      logger.error( "onWat error: %s", err )
      return
    }
    if ( res )
      msg.reply( res )
  } )
}

const load = function( bot ) {
  if ( rc )
    return irc.STATUS.SUCCESS
  rc = redis.createClient( PORT, HOST )
  rc.auth( TOKEN )
  rc.on( share.redis.EVENT.ERROR, handleError )
  bot.lookFor( /\bw[au]t\b/i, onWat )
  getJson()
  return irc.STATUS.SUCCESS
}

const eject = function() {
  if ( rc )
    rc.quit()
  return irc.STATUS.SUCCESS
}

module.exports =
  { name:   "Wat"
  , load:   load
  , eject:  eject
  }
