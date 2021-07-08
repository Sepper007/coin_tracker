const auth = {
    required: (req, res, next) => {
        if (!req.isAuthenticated()) {
            res.status(401).send({ errorMessage: 'Unauthorized' });
        } else {
            next();
        }
    },
    adminOnly: (req, res, next) => {
        if (!req.user.roles.includes('admin')) {
            res.status(403).send({errorMessage: 'Forbiden'});
        } else {
            next();
        }
    }
};

module.exports = auth;
