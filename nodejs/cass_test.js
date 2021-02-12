const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'test',
    credentials : {username : "iotuser", password : "iotuser"}
});

const query = 'SELECT id, username FROM users;';

client.execute(query)
.then(result => console.log('User with username: "%s" and uuid: "%s"', result.rows[0].id, result.rows[0].username));