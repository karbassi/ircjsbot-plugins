/**
 * @module eval
 */

const fmt   = require( "util" ).format
    , irc   = require( "irc-js" )
    , spawn = require( "child_process" ).spawn
    , share = require( "./shared" )

const logger = irc.logger.get( "ircjs" )

const death = function( msg, code, error ) {
  msg.reply( fmt( "%s, oh nooo, there was an error: %s", msg.from.nick, error ) )
  // if ( error )
    // client.send( irc.message( irc.person( msg.from.nick )
                             // , "PRIVMSG"
                             // , fmt( "Hey, here is your original code: %s\nAnd the error details: %s", code, error ) ) )
}

const speak = function( msg, person, out ) {
  msg.reply( fmt( "%s, %s", person || msg.from.nick, out ) )
}

const shell = function( exe, args, code, hb ) {
  var stdout = ""
    , stderr = ""

  const child = spawn( exe, args )
      , stdoutput = function( out ) { if ( !!out ) stdout += out }
      , stderrput = function( out ) { if ( !!out ) stderr += out }

  child.stdout.on( "data", stdoutput )
  child.stderr.on( "data", stderrput )
  child.on( "exit", function( ecode ) {
    hb.call( null, stdout || null, stderr || null )
  } )
  child.stdin.write( code )
  child.stdin.end()
}

// Languages

const clojure = function( msg, code, person ) {
  shell( "java", [ "-jar", __dirname + "/eval/srepl-1.0.0-standalone.jar" ]
        , code
        , function( stdout, stderr ) {
          if ( stderr )
            death( msg, code, stderr )
          else
            speak( msg, person, stdout )
        } )
}


const racket = function( msg, code, person ) {
  shell( "racket", [ __dirname + "/eval/sandboxed-ipc-repl.rkt" ]
        , code
        , function( stdout, stderr ) {
          if ( stderr )
            death( msg, code, stderr )
          else
            speak( msg, person, stdout )
        } )
}

// Implement Plugin interface.

const load = function( bot ) {
  bot.lookFor( /^:[\/.,`?]?(?:clj|clojure)(?:→|->)? *(.*)$/, clojure )
  bot.lookFor( /^:[\/.,`?]?(?:rkt|racket)(?:→|->)? *(.*)$/, racket )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  return irc.STATUS.SUCCESS
}

exports.name  = "Eval"
exports.load  = load
exports.eject = eject

