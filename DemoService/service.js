import { check, status, group, sleep } from "k6";
import x from "../DemoService/api/calls.js";

export function callList(){

    group("T01_Transaction", x.call1);
    sleep(2);
    group("T02_Transaction", x.call2);
    sleep(2);
    group("T03_Transaction", x.call3);
    sleep(2);
    group("T04_Transaction", x.call4);
    sleep(2);
    group("T05_Transaction", x.call5);
}