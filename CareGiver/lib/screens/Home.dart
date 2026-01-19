import 'package:flutter/material.dart';

class Home extends StatelessWidget {
  const Home({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TextButton(
            style: TextButton.styleFrom(
              foregroundColor: Colors.red
            ),
            onPressed: (){
      
            },          
            child:const Text(
              "Text",
              style: TextStyle(
                fontSize: 25,
                fontWeight: FontWeight.bold,
              ),
              ),
            
            ),
            const SizedBox(height: 10,),
            FilledButton(
              onPressed: (){},
              child: Text(
                "Fill",
                style: TextStyle(
                  fontSize: 25),
              )
            ),
            const SizedBox(height: 10,),
            OutlinedButton(
              onPressed: (){}, 
              child: Text("Outline")
            ),
            ElevatedButton(onPressed: (){}, child: Text(" Elevated"))
        ],
       
      ),
    );
  }
}
