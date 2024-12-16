import http from "k6/http";
import { check, status, group, sleep } from "k6";
import {baseURL} from "../main.js";
import {findBetween} from "../utils.js"


let call1 = function(){
    let headers={};
    let tagname = "T01_Transaction";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange";
    headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
    headers["authority"] = "fake-json-api.mock.beeceptor.com";
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
    headers["Accept-Language"] = "en-US";
    headers["Cache-Control"] = "max-age=0";
    headers["path"] = "/users";
    headers["scheme"] = "https";
    //let endpoint = "https://fake-json-api.mock.beeceptor.com/users";
    let endpoint = baseURL + "/users";
    let response = http.get(endpoint, {headers: headers, tags:{name:tagname, RT: tagname, TPS: tagname}});

    const message = findBetween(response.body, '\"photo\": \"', '\"');
    console.log("Message is: " +message);

    ChecksandDebug(response, endpoint, tagname);
}

let call2 = function(){
    let headers={};
    let tagname = "T02_Transaction";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange";
    headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
    headers["authority"] = "fake-json-api.mock.beeceptor.com";
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
    headers["Accept-Language"] = "en-US";
    headers["Cache-Control"] = "max-age=0";
    headers["path"] = "/users";
    headers["scheme"] = "https";
    //let endpoint = "https://fake-json-api.mock.beeceptor.com/companies";
    let endpoint = baseURL +"/companies";
    let response = http.get(endpoint, {headers: headers, tags:{name:tagname, RT: tagname, TPS: tagname}});

    ChecksandDebug(response, endpoint, tagname);
}

let call3 = function(){
    let headers={};
    let tagname = "T03_Transaction";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange";
    headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
    headers["authority"] = "fake-json-api.mock.beeceptor.com";
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
    headers["Accept-Language"] = "en-US";
    headers["Cache-Control"] = "max-age=0";
    headers["path"] = "/users";
    headers["scheme"] = "https";
    //let endpoint = "https://dummy-json.mock.beeceptor.com/todos";
    let endpoint = baseURL + "/todos";
    let response = http.get(endpoint, {headers: headers, tags:{name:tagname, RT: tagname, TPS: tagname}});

    ChecksandDebug(response, endpoint, tagname);
}

let call4 = function(){
    let headers={};
    let tagname = "T04_Transaction";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange";
    headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
    headers["authority"] = "fake-json-api.mock.beeceptor.com";
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
    headers["Accept-Language"] = "en-US";
    headers["Cache-Control"] = "max-age=0";
    headers["path"] = "/users";
    headers["scheme"] = "https";
    //let endpoint = "https://dummy-json.mock.beeceptor.com/posts";
    let endpoint = baseURL + "/posts";
    let response = http.get(endpoint, {headers: headers, tags:{name:tagname, RT: tagname, TPS: tagname}});

    ChecksandDebug(response, endpoint, tagname);
}

let call5 = function(){
    let headers={};
    let tagname = "T05_Transaction";
    headers["Accept"] = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange";
    headers["Accept-Encoding"] = "gzip, deflate, br, zstd";
    headers["authority"] = "fake-json-api.mock.beeceptor.com";
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0";
    headers["Accept-Language"] = "en-US";
    headers["Cache-Control"] = "max-age=0";
    headers["path"] = "/users";
    headers["scheme"] = "https";
    //let endpoint = "https://dummy-json.mock.beeceptor.com/continents";
    let endpoint = baseURL + "/continents";
    let response = http.get(endpoint, {headers: headers, tags:{name:tagname, RT: tagname, TPS: tagname}});

    ChecksandDebug(response, endpoint, tagname);
}

function ChecksandDebug(response, endpoint, tagname){
    if(response.status ==200 || response.status ==201){
        check(response, {Validation : (r) => r.status === response.status}, {Checks:tagname});
    }
    else{
        check(response, {Validation: (r) => r.status ==200 || r.status ==201}, {Checks:tagname});
        console.log(`${tagname} failed with status code: `, response.status);

    if(DebugMessage == "yes"){
        console.log("Endpoint: "+endpoint, "Transaction Name: "+tagname)
        console.log("Response Body for debug: ", tagname, response.body);
     }
    }
}

export default Object.freeze({
    call1,
    call2,
    call3,
    call4,
    call5
})