import {group, sleep } from "k6";
import x from "../DemoServiceUI/uicalls.js"
import { loginstatus } from "../DemoServiceUI/uicalls.js";

export function callList(){

    group("T01_Demo_K6LaunchPage", x.launchpage);
    sleep(2);
    group("T02_Demo_K6LoginPage", x.loginpage);
    sleep(2);
    group("T03_Demo_K6Login", x.login);
    sleep(2);
    if (loginstatus == 1)
    {
    group("T04_Demo_K6Logout", x.logout);
    }
    sleep(2);
}