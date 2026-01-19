import 'package:flutter/material.dart';

enum Job { 
  doctor(title:"หมอ",color:Colors.red),
  teacher(title:"ครู",color:Colors.grey),
  nurse(title:"พยาบาล",color:Colors.blue),
  police(title:"ตำรวจ",color:Colors.greenAccent);

  const Job({required this.title, required this.color});
  final String title;
  final Color color;
}

class Person {
  Person({required this.name, required this.age, required this.job});
  String name;
  int age;
  Job job;
}

List<Person> data = [
  Person(name: "Few", age: 20, job: Job.doctor),
  Person(name: "May", age: 19, job: Job.teacher),
  Person(name: "Rojer", age: 24, job: Job.nurse),
  Person(name: "Chalee", age: 50, job: Job.police),
];
