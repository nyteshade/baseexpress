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
  if (context.params.gender) {
    context.params.gender = /(male|m|man|boy|men|guy)/i.exec(context.params.gender)
        ? 'boys' : context.params.gender;
    context.params.gender = /(female|f|woman|girl|women|gal|lady)/i.exec(context.params.gender)
        ? 'girls' : context.params.gender;
  }

  res.render('index', context);
};
