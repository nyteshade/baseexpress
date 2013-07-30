/**
 * GET home page.
 */

exports.index = function(req, res) {
  var context = {
    title: 'Express',

    // Only occurs with parameterized route
    params: req.params.name && req.params.gender && {
      name: req.params.name || undefined,
      gender: req.params.gender || undefined
    } || undefined
  };

  // Only occurs with parameterized route
  if (context.params) {
    context.params.gender = /(male|m|man|boy|men|guy)/i.exec(context.params.gender)
        ? 'boys' : context.params.gender;
    context.params.gender = /(female|f|woman|girl|women|gal|lady)/i.exec(context.params.gender)
        ? 'girls' : context.params.gender;
  }

  res.render('index', context);
};

exports.testMongo = function(req, res) {
  // Assuming mongodb is running locally and the following has been 
  // executed in the mongo shell
  // > use rockband
  // > db.bands.insert({name: 'Hollywood Rose', members: ['Axl Rose', 'Izzy Stradlin', 'Chris Weber'], year: 1984})
  // > db.bands.insert({name: 'Road Crew', members: ['Slash', 'Steven Adler', 'Duff McKagan'], year: 1984})
  // > db.bands.insert({name: 'L.A. Guns', members: ['Tracy Guns', 'Paul Black', 'Mick Cripps', 'Nickey Alexander'], year: 1985})
  // > db.bands.insert({name: "Velvet Revolver", members: ['Scott Weiland', 'Slash', 'Dave Kushner', 'Matt Sorum', 'Duff McKagan'], year: 2002})
  var db = require('mongoskin').db('localhost:27017/rockband', {journal: true});

  db.collection('bands').find().toArray(function(err, results) {
    res.render('index', {
      title: 'Express (Mongoified)', 
      bands: results, 
      error: err
    });
  });
}
