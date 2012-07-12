const fmt = require( "util" ).format
    , irc = require( "irc-js" )

// Redis stuff
const TOKEN = "ff774f90da063a0dfa783172f16af4e3"
    , HOST  = "127.0.0.1"
    , PORT  = 6379

// Redis events
const EVENT =
    { ERROR: "error"
    }

// Redis status codes
const STATUS =
    { ERROR: 0
    , SUCCESS: 1
    }

const getKey = function( nick, prefix ) {
  const id = nick instanceof irc.Person ? nick.id : new irc.Person( nick, null, null ).id
      , p = prefix || "IRCJS"
  return p + id
}

const times =
  [ 1000
  , 60 * 1000
  , 60 * 60 * 1000
  , 24 * 60 * 60 * 1000
  , 7  * 24 * 60 * 60 * 1000
  ]

const labels = [ "s", "m", "h", "d", "w" ]

const timeAgo = function( t, acc ) {
  const out = acc || []
  var rem = Math.round( Date.now() - t )
    , idx = times.length
    , cnt = 0
  while ( idx-- ) {
    cnt = ~~( rem / times[ idx ] )
    if ( cnt ) {
      rem -= cnt * times[ idx ]
      out.push( cnt + labels[ idx ] )
    }
  }
  return out.splice( 0, 2 ).join( ' ' )
}

const join = function( arr ) {
  const last = arr.pop()
  if ( arr.length === 0 )
    return last
  return fmt( "%s and %s", arr.join( ", " ), last )
}

exports.join = join
exports.timeAgo = timeAgo

exports.redis =
  { EVENT:  EVENT
  , STATUS: STATUS
  , TOKEN:  TOKEN
  , HOST:   HOST
  , PORT:   PORT
  , key:    getKey
  }
