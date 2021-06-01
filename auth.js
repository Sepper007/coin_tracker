const auth = {
    required: (req, res, next) => {
        if (!req.isAuthenticated()) {
            res.status(401).send({ errorMessage: 'Unauthorized' });
        } else {
            next();
        }
    }
};

module.exports = auth;
