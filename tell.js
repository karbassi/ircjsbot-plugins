/** @module tell
 *  @todo Only add observers for people who have notes waiting for them.
 *        Then remove when list is empty.
 */

const redis = require( "redis" )
    , irc   = require( "irc-js" )
    , fmt   = require( "util" ).format
    , share = require( "./shared" )

const rds = share.redis

const logger = irc.logger.get( "ircjs" )

const RPREFIX = "TELL"

const DELIM = String.fromCharCode( 0xA )

var tellInstance = null

const Note = function( from, to, note ) {
  this.date = Date.now()
  this.from = from
  this.note = note
  this.new  = true
}

Note.prototype.toString = function() {
  return [ this.new, this.date, this.from, this.to, this.note ].join( DELIM )
}

Note.fromString = function( s ) {
  const parts = s.split( DELIM )
      , note  = new Note( parts[2], parts[3], parts[4] )
  note.new  = parts[0] === "true"
  note.date = Number( parts[1] )
  return note
}

const Tell = function( bot ) {
  if ( tellInstance )
    return tellInstance
  tellInstance = this
  this.client = redis.createClient( rds.PORT, rds.HOST )
  this.client.on( rds.EVENT.ERROR, this.error.bind( this ) )
  this.client.auth( rds.TOKEN )
  this.bot = bot
}

Tell.prototype.error = function( err ) {
  logger.error( "tell.js redis client error: %s", err )
}

Tell.prototype.tell = function( msg, num ) {
  // Probably full of async-y bugs, how to update a bunch of items at once and get a callback?
  const nick = msg.from.nick
      , key = rds.key( msg.from, RPREFIX )
  this.client.lrange( key, 0, -1, function( err, notes ) {
    if ( err ) {
      logger.error( "Redis error in tell.js Tell.prototype.tell: %s", err )
      return
    }
    if ( ! notes || 0 === notes.length )
      return
    
    var reply = null
      , note = null
      , new_ = 0
      , l = notes.length
      , i
    for ( i = 0; i < l ; ++i ) {
      note = Note.fromString( notes[i] )
      if ( ! note.new )
        continue
      ++new_
      note.new = false
      logger.debug( "Marking note from %s (%s) as not new", note.from, note )
      this.client.lset( key, i, note.toString() )
    }
    if ( 0 === new_ )
      return
    reply = fmt( "%s, you have %s, just say “read” to me when you wish to read %s."
               , nick, new_ === 1 ? "one new message" : new_ + " new messages"
               , new_ === 1 ? "it" : "them" )
    msg.reply( reply )
  }.bind( this ) )
}

Tell.prototype.read = function( msg ) {
  const nick = msg.from.nick
      , pm = msg.params[0] === this.bot.user.nick
      , forMe = pm || -1 !== msg.params[1].indexOf( this.bot.user.nick )
      , key = rds.key( msg.from, RPREFIX )

  if ( ! forMe )
    return

  this.client.lrange( key, 0, -1, function( err, notes ) {
    if ( err ) {
      logger.error( "Redis error in tell.js: %s", err )
      return
    }

    if ( ! notes || 0 === notes.length ) {
      msg.reply( "%sNo unread messages.", pm ? "" : nick + ", " )
      return
    }
    var l = notes.length
      , note = null
    while ( l-- ) {
      note = Note.fromString( notes[l] )
      msg.reply( "%sfrom %s, %s ago: %s", pm ? "" : nick + ", "
        , note.from, share.timeAgo( note.date ), note.note )
    }
    this.client.del( key )
    return irc.STATUS.STOP  // Prevent "tell" from doing anything
  }.bind( this ) )
}

Tell.prototype.add = function( msg, name, note ) {
  const forMe = -1 !== msg.params[1].indexOf( this.bot.user.nick )
      , from  = msg.from.nick
      , key   = rds.key( name, RPREFIX )
  if ( ! forMe )
    return
  if ( key === rds.key( from, RPREFIX ) ) {
    msg.reply( "%s, %s", from, note )
    return
  }
  if ( key === rds.key( this.bot.user.nick, RPREFIX ) ) {
    msg.reply( "%s, whatever you say…", from )
    return
  }
  const rnote = new Note( from, key, note )
  this.client.lpush( key, rnote.toString() )
  msg.reply( "%s, I’ll tell %s about that.", from, name )
  logger.debug( "Added note from %s to %s: %s", from, name, note )
  return irc.STATUS.STOP
}

Tell.prototype.disconnect = function( msg ) {
  logger.info( "Telling tell.js Redis client to quit" )
}

// Implement Plugin interface.

const load = function( client ) {
  const t = new Tell( client )
  client.observe( irc.COMMAND.PRIVMSG, t.tell.bind( t ) )
  client.lookFor( fmt( "^:(?:\\b%s\\b[\\s,:]+|[@!\\/?\\.])tell\\s+([-`_\\{\\}\\[\\]\\^\\|a-z0-9]+)[:,]?\\s+(.+)"
    , client.user.nick ), t.add.bind( t ) )
  client.lookFor( fmt( "^:(?:\\b%s\\b[\\s,:]+|[@!\\/?\\.])read\\b"
    , client.user.nick ), t.read.bind( t ) )
  logger.info( "Registered Tell plugin" )
  return irc.STATUS.SUCCESS
}

const eject = function() {
  tellInstance.client.quit()
  tellInstance = null
  return irc.STATUS.SUCCESS
}

module.exports =
  { name: "Tell"
  , load: load
  , eject: eject
  }
