const http = require('http');
const cassandra = require('cassandra-driver');
//const uuid = require('uuid');

const client = new cassandra.Client({
    contactPoints: ['127.0.0.1'],
    localDataCenter: 'datacenter1',
    keyspace: 'test',
    credentials: { username: "iotuser", password: "iotuser" }
});



const VERBOSE = true;

// userid -> uuid, date -> date("YYYY-MM-DD"), [ts -> timeuuid], deviceid -> uuid, humidity -> float, temperature -> integer
const query_POST_entry = "INSERT INTO entries_by_userid (userid, date, ts, deviceid, humidity, temperature) VALUES (?, ?, now(), ?, ?, ?);";

const query_GET_entries = "SELECT date, ts, temperature, humidity, deviceid FROM entries_by_userid WHERE userid = ? AND date = ?;";

const query_POST_auth = "SELECT userid FROM users WHERE username = ? AND password = ?;";

const query_POST_new_user_check = "SELECT count(*) FROM users WHERE username = ?;";
const query_POST_new_user = "INSERT INTO users (username, password, userid) VALUES (?, ?, uuid());";

//this has to be solved client-side, eg. after logging in get userid and also the devices have to be settable to its users id
const uuid_v4_simple_regex = "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}";

let test_content = "Please use the correct URLs.";

http.createServer(function (request, response) {

    if (request.method == "GET") {
        if (VERBOSE)
            console.log("GET " + request.url);
        let req_url = new URL(request.url, "http://" + request.headers.host);

        if (request.url == "/test" || request.url == "/") {
            response.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Origin, X-Requested-With, Content-Type, Accept'});
            response.write(test_content);
            response.end();
            if (VERBOSE)
                console.log('Served GET(test)...');

        } else if (req_url.pathname == "/get_entries") {
            let queries = {userid:"",date:""};
            try {
                req_url.searchParams.forEach((value, key) => {
                    queries[key] = value;
                });

                if (!(queries.userid.match(uuid_v4_simple_regex))) {
                    if (VERBOSE)
                        console.log("Match: " + queries.userid.match(uuid_v4_simple_regex));
                    response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                    response.write("BAD_DATA");
                    response.end();
                    if (VERBOSE)
                        console.log("Served bad GET(UUID)...");
                    return;
                }

            } catch (error) {
                response.writeHead(400, { "Content-Type": "text/html" });
                response.write("BAD_DATA");
                response.end();
                if(VERBOSE)
                    console.log("No data");
                return;
            }

            

            if (VERBOSE)
                console.log(queries);

            let rows = [];
            let params = [queries.userid, queries.date];
            client.eachRow(query_GET_entries, params, { prepare: true, autoPage: true }, (n, row) => {
                rows.push(row);
            }, () => {
                console.log("Number of returned rows: " + rows.length);
                response.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept" });
                response.write(JSON.stringify(rows));
                response.end();
                if (VERBOSE)
                    console.log("Served GET(entries)...")
            });
        }
        else {
            response.writeHead(400, { 'Content-Type': 'text/html' , 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Origin, X-Requested-With, Content-Type, Accept'});
            response.write("Nothing specified...");
            response.end();
            if (VERBOSE)
                console.log("Served bad GET(not specified)...")
        }
        //---------------------------------------------------------------------------------------------------
    } else if (request.method == "POST") {
        if (VERBOSE)
            console.log("POST " + request.url);
        let body = "";
        request.on('data', (data) => {
            body += data;
            if (VERBOSE)
                console.log("Partial body: " + body);
        });
        request.on('end', () => {
            if (VERBOSE)
                console.log("Body: " + body);
            
            let content;
            try {
                content = JSON.parse(body);
            } catch (error) {
                if(VERBOSE)
                    console.log(error.message);
                response.writeHead(500, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                response.end("ERROR_EXPECTED_JSON");
                return;
            }

            if (request.url == "/new_entry") {
                response.writeHead(200, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                response.end("OK");

                try {
                    if(content.user_id === undefined || content.device_id === undefined || content.temperature === undefined || content.humidity === undefined){
                        //if some part of the neccessary data is missing, yeet
                        if(VERBOSE)
                            console.log("Missing data in /new_entry");
                        return;
                    }
                } catch (error) {
                    if(VERBOSE)
                        console.log(error);
                    return;
                }

                if (VERBOSE) {
                    console.log(content.user_id);
                    console.log(content.device_id);
                    console.log(content.temperature);
                    console.log(content.humidity);
                }


                //prepare the "date" field
                let date = new Date();
                let time = date.getUTCFullYear() + "-" + (date.getUTCMonth() + 1) + "-" + date.getUTCDate();
                if (VERBOSE)
                    console.log(time);



                let params = [content.user_id, time, content.device_id, content.humidity, content.temperature];
                client.execute(query_POST_entry, params, { prepare: true }).then((result) => {
                    if (VERBOSE)
                        console.log("Logged...");
                });
            } else if (request.url == "/authenticate") {
                try {
                    if(content.username === undefined || content.password === undefined){
                        //if some part of the neccessary data is missing, yeet
                        response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                        response.end("BAD_USERNAME_OR_PASSWORD");
                        if(VERBOSE)
                            console.log("Missing data in /authenticate");
                        return;
                    }
                } catch (error) {
                    response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                    response.end("BAD_USERNAME_OR_PASSWORD");
                    
                    if(VERBOSE)
                        console.log(error);
                    return;
                }

                if (VERBOSE) {
                    console.log(content.username);
                    console.log(content.password);
                }

                let params = [content.username.trim(), content.password.trim()];
                client.execute(query_POST_auth, params, { prepare: true }).then((result) => {
                    if (result.rows.length != 1) {
                        response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                        response.end("BAD_USERNAME_OR_PASSWORD");
                    } else {
                        let uuid_result;
                        try {
                            uuid_result = result.rows[0].userid;
                            //probably no need to convert, since the bytes get implicitly converted to chars, atlest SOAPUI says so, try-catch block stays though
                            if(VERBOSE)
                                console.log(uuid_result);
                            response.writeHead(200, { "Content-Type": "application/json" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                            response.write(JSON.stringify(uuid_result));
                            response.end();
                        } catch (error) {
                            if(VERBOSE)
                                console.log(error);
                            response.writeHead(500, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                            response.end("ERROR");
                        }
                    }
                }).catch(()=> {
                    response.writeHead(500, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                    response.end("ERROR");
                    if(VERBOSE)
                        console.log("Failure in query execution...")
                });
            } else if(request.url == "/new_user"){
                try {
                    if(content.username === undefined || content.password === undefined){
                        //if some part of the neccessary data is missing, yeet
                        response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                        response.end("BAD_USERNAME_OR_PASSWORD");
                        if(VERBOSE)
                            console.log("Missing data in /new_entry");
                        return;
                    }
                } catch (error) {
                    response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                    response.end("BAD_USERNAME_OR_PASSWORD");
                    
                    if(VERBOSE)
                        console.log(error);
                    return;
                }

                if(VERBOSE){
                    console.log(content.username);
                    console.log(content.password);
                }

                let params = [content.username.trim()];
                client.execute(query_POST_new_user_check, params, {prepare:true}).then((result)=>{
                    if(result.rows[0].count != 0){
                        if(VERBOSE)
                            console.log("Username taken...")
                        response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                        return response.end("USERNAME_TAKEN");
                    } else {
                        params = [content.username.trim(), content.password.trim()];
                        client.execute(query_POST_new_user, params, {prepare:true}).then((result)=> {
                            if(VERBOSE)
                                console.log(result);
                            response.writeHead(200, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                            response.end("OK");
                        });
                    }
                }).catch((result)=>{
                    if(VERBOSE)
                            console.log(result);
                        response.writeHead(400, { "Content-Type": "text/html" , "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"Origin, X-Requested-With, Content-Type, Accept"});
                        return response.end("BAD_USERNAME_OR_PASSWORD");
                });
            }
            
        });
    }
}).listen(8081);

console.log('Server running at http://192.168.1.2:8081/');