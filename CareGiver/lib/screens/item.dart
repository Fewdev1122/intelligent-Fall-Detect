import 'package:flutter/material.dart';
import 'package:myproject/models/person.dart';

class Item extends StatefulWidget {
  const Item({super.key});

  @override
  State<Item> createState() => _ItemState();
}

class _ItemState extends State<Item> {

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: data.length,
      itemBuilder: (context,index){
        return Container(
          decoration: BoxDecoration(
            color: data[index].job.color
          ),
          margin: EdgeInsets.symmetric(horizontal: 5,vertical: 5),
          padding: EdgeInsets.all(5),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    data[index].name,
                    style: TextStyle(
                      fontSize: 20,
                    ),
                  ),
                  Text(
                    "age: ${data[index].age} and job: ${data[index].job.title}",
                    style: TextStyle(
                      fontSize: 20
                    ),
                  )
                ],
              ),
              Image.network(
                'https://i.pinimg.com/474x/f5/21/12/f521127cfe76995a71fa597160da220d.jpg',
                width: 70,
                height: 70,
              )
            ],
            
          )
        );
      },
    );
  }
}