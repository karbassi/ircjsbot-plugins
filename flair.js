/**
 * @module flair
 */
const irc = require( "irc-js" )

const FLAIR =
  [ [ /\balligator\b/i, "---,==,'<" ]
  , [ /\bshrugs\b/i,    "¯\\_(ツ)_/¯" ]
  , [ /\by u\b/i,       "(屮'Д')屮" ]
  ]

const speak = function( reply, msg ) {
  msg.reply( reply )
}

const load = function( bot ) {
  FLAIR.forEach( function( f ) {
    bot.lookFor( f[0], speak.bind( null, f[1] ) )
  } )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  return irc.STATUS.SUCCESS
}

exports.name  = "Flair"
exports.load  = load
exports.eject = eject

