var hb_conf    = require('./config.js').hbase,
    moment     = require('moment'),
    hbase      = require('hbase');

module.exports = {
  
  client : hbase({
    host : hb_conf.host,
    port : hb_conf.port
  }),

  addPing : function (client, pk, datetime, trusted){
  datetime = new Date(datetime);
  dt = moment(datetime).format("YYYYMMDDHHmmss");
  rowkey = dt+"|"+pk;
  client
    .getRow('validatorTracker', rowkey)
    .put('data:trusted', trusted, function(error, success){
      if (error) console.log(error);
    });
  },

  createScanner : function(start,end,callback){
    if (start == 0) start = '';
    if (end == 0) end = '';
    var pingScanner = new hbase.Scanner(client, 'validatorTracker');
    pingScanner.create({
      startRow: start,
      endRow: end
    }, 
    function(error, cells){
      if (error) callback(error);
      else callback(null, pingScanner);
    });
  },

  getPings : function (scanner, callback){
    scanner.get(function(error, cells){
      if (error) callback(error);
      else if(cells){
        callback(null, cells);
      }
      else{
        this.delete();
        callback("no entries with given filters");
      }
    });
  }

}