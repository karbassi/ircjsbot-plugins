const fmt     = require( "util" ).format
    , https   = require( "https" )
    , irc     = require( "irc-js" )
    , share   = require( "./shared" )
    , jQJSON  = require( "./jqapi.json" )
    , log     = irc.logger.get( "ircjs-plugin-jqapi" )

const onJQAPI = function( msg ) {

  log.debug( "onJQAPI triggered" )
  
  const splat = msg.params[ 1 ].split( ' ' )
      , s = splat[ 0 ].replace( ':?', '' )
      , to = ( splat[ 1 ] === '@' && splat[ 2 ] && splat.length === 3 ) ? splat[ 2 ] : ''
      , a = jQJSON
      
  var res = ''
  
  if ( splat.length ) {
      Object.keys( a ).map( function( k ) {
        
        var name = a[ k ].name
          , title = a[ k ].title
          , desc = a[ k ].desc
          , url = a[ k ].url
        
        // search for selector
        if ( s.indexOf( ':' ) >= 0 ) {
          if ( title.indexOf( 'Selector' ) >= 0 && name == s.replace( ':', '' ) ) {
            res = title + ': ' + desc + ' ' + url
            return
          }
          
        // everything else
        } else if ( name.toLowerCase() == s.toLowerCase() && title.indexOf( ':' ) == -1 ) {
          res = title + ': ' + desc + ' ' + url
          return
        }
      })
    }
    
    // say what you need to say
    if ( res != '' ) {
      if ( to ) {
        msg.reply( to + ': ' + res )
      } else {
        msg.reply( msg.from.nick + ': ' + res )
      }
    }
}

const load = function( bot ) {
  bot.lookFor( /\?([^#@]+)(?:\s*#([1-9]))?(?:\s*@\s*([-\[\]|_\w]+))?$/, onJQAPI )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  return irc.STATUS.SUCCESS
}

module.exports =
  { name:   "JQAPI"
  , load:   load
  , eject:  eject
  }