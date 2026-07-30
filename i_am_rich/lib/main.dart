import 'package:flutter/material.dart';

void main() {
  runApp(
    MaterialApp(
      theme: ThemeData(useMaterial3: false),
      home: Scaffold(
        backgroundColor: Colors.blueGrey,
        appBar: AppBar(
          title: const Text('I AM RICH'),
          backgroundColor: Colors.blueGrey[900],
          centerTitle: true,
        ),
        // body: const Center(
        //   child: Image(
        //     image: NetworkImage(
        //       'https://flutter.github.io/assets-for-api-docs/assets/widgets/owl.jpg',
        //     ),
        //   ),
        // ),
        body: Center(child: Image(image: AssetImage('images/img.png'))),
      ),
    ),
  );
}
