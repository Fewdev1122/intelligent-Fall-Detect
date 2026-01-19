import 'package:flutter/material.dart';
import 'package:myproject/screens/Home.dart';
import 'package:myproject/screens/item.dart';
void main() {
  runApp(const MyApp());
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});
  
  @override
  _MyAppState createState() => _MyAppState(); 
}

class _MyAppState extends State<MyApp> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Fall Detect",
      home: Scaffold(
        appBar: AppBar(
          title: const Text("Fall Detect"),
          backgroundColor: Colors.blue,
        ),
        body: const Item(), 
      ),
    );
  }
}
