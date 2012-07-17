const redis = require( "redis" )
    , fmt   = require( "util" ).format
    , https = require( "https" )
    , irc   = require( "irc-js" )
    , share = require( "./shared" )

const TOKEN = share.redis.TOKEN
    , HOST  = share.redis.HOST
    , PORT  = share.redis.PORT

const log     = irc.logger.get( "ircjs-plugin-crew" )
    // All data is stored in a Redis hash, with normalized IRC nicks as keys.
    , crewKey = "CREW"
    , crewURL = { host: "raw.github.com"
                , path: "/jquery-ot/ot-crew.com/master/public/crew.json" }

/** The data is an array of these:
 *    { "irc": "nick"
 *    , "twitter": "handle"
 *    , "github": "user"
 *    , "location": "place"
 *    , "name": "first last other or so"
 *    , "birthday": "A Date object, one might think, and be wrong"
 *    , "imgUrl": "http://www.jpg.gif"
 *    , "occupation": "liberation"
 *    }
 */

const onRedisError = function( error ) {
  log.error( "Crew Redis client error: %s", error )
}

const redisClient = redis.createClient( PORT, HOST )
// Should only be called once, regardless of dis/reconnecting etc, docs say.
redisClient.auth( TOKEN )
redisClient.on( share.redis.EVENT.ERROR, onRedisError )

// Looks for ?f(inger) <name>, replies with crew data.
const onFinger = function( msg, nick ) {
  redisClient.hget( crewKey, irc.id( nick )
    , function( err, res ) {
    if ( err ) {
      log.error( "Error getting crüe data: %s", err )
      return irc.STATUS.ERROR
    }
    // Dunno how to present it nicely, this will do for now.
    if ( res )
      msg.reply( "%s, %s", msg.from.nick, res )
    else
      msg.reply( "%s, no idea who %s is.", msg.from.nick, nick )
  } )
  return irc.STATUS.STOP
}

const load = function( client ) {
  /** Thought I'd reconnect here if needed, and disconnect in eject(),
   *  but node_redis doesn't seem to do that (?). So just stay connected.
   *  @todo Revisit this later and see if node_redis changed.
   *    if ( ! redisClient.connected ) {
   *    }
   */
  // GET ALL JSON EVEN IF NOT NEEDED, HOW SUBVERSIVE TAKE THAT THE MAN
  https.get( crewURL, function( response ) {
    const data = []
    response.on( irc.NODE.SOCKET.EVENT.DATA, function( dataPiece ) {
      data.push( dataPiece )
    } )
    response.on( irc.NODE.SOCKET.EVENT.END, function() {
      // Better be valid JSON, otherwise: DOOM.
      const crewArray = JSON.parse( data.join( '' ) )
          , headCount = crewArray.length
      log.debug( "Got crew data:", crewArray )
      // Now convert from array of objects to object keyed on nick/id
      // because then we can shove it straight into redis with hmset.
      const redisData = {}
      crewArray.forEach( function( crewMember ) {
        redisData[ irc.id( crewMember.irc ) ] = JSON.stringify( crewMember )
      } )
      redisClient.hmset( crewKey, redisData )
    } )
  } )
  // These disgusting stringexes are everywhere, there's no escape, help!
  // Actually they are full of escapes.
  client.lookFor( fmt( "^:(?:%s\\b[\\s,:]+|[@!\\/?\\.])f(?:inger)?\\s+([^\\s]+)"
    , client.user.nick ), onFinger )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  /** if ( redisClient.connected )
   *    redisClient.quit()
   */
  return irc.STATUS.SUCCESS
}

exports.name  = "Crew"
exports.load  = load
exports.eject = eject
