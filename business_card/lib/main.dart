import 'package:flutter/material.dart';

void main() {
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: Colors.blueGrey[900],
        body: SafeArea(
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircleAvatar(
                  radius: 60,
                  backgroundImage: AssetImage('images/profile.png'),
                ),

                SizedBox(height: 20),

                Text(
                  'Aateka Memon',
                  style: TextStyle(
                    fontSize: 35,
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),

                Text(
                  'FLUTTER DEVELOPER',
                  style: TextStyle(
                    color: Colors.white70,
                    letterSpacing: 3,
                    fontSize: 18,
                  ),
                ),

                SizedBox(height: 20),

                SizedBox(
                  width: 200,
                  child: Divider(color: Colors.white54, thickness: 1),
                ),

                Card(
                  margin: EdgeInsets.symmetric(horizontal: 25, vertical: 10),
                  child: Padding(
                    padding: EdgeInsets.all(15),
                    child: Row(
                      children: [
                        Icon(Icons.phone, color: Colors.teal),

                        SizedBox(width: 20),

                        Text('+91 9876543210', style: TextStyle(fontSize: 18)),
                      ],
                    ),
                  ),
                ),

                Card(
                  margin: EdgeInsets.symmetric(horizontal: 25, vertical: 10),
                  child: Padding(
                    padding: EdgeInsets.all(15),
                    child: Row(
                      children: [
                        Icon(Icons.email, color: Colors.teal),

                        SizedBox(width: 20),

                        Text(
                          'aateka@gmail.com',
                          style: TextStyle(fontSize: 18),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
