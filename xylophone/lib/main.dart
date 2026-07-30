// import 'package:flutter/material.dart';
// import 'package:audioplayers/audioplayers.dart';
//
// void main() {
//   runApp(const XylophoneApp());
// }
//
// class XylophoneApp extends StatelessWidget {
//   const XylophoneApp({super.key});
//
//   @override
//   Widget build(BuildContext context) {
//     return const MaterialApp(
//       debugShowCheckedModeBanner: false,
//       home: XylophonePage(),
//     );
//   }
// }
//
// class XylophonePage extends StatelessWidget {
//   const XylophonePage({super.key});
//
//   void playSound(int soundNumber) {
//     final player = AudioPlayer();
//     player.play(AssetSource('note$soundNumber.wav'));
//   }
//
//   Expanded buildKey(Color color, int soundNumber) {
//     return Expanded(
//       child: TextButton(
//         style: TextButton.styleFrom(
//           backgroundColor: color,
//           shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
//         ),
//         onPressed: () {
//           playSound(soundNumber);
//         },
//         child: const SizedBox(),
//       ),
//     );
//   }
//
//   @override
//   Widget build(BuildContext context) {
//     return Scaffold(
//       body: SafeArea(
//         child: Column(
//           crossAxisAlignment: CrossAxisAlignment.stretch,
//           children: [
//             buildKey(Colors.red, 1),
//             buildKey(Colors.orange, 2),
//             buildKey(Colors.yellow, 3),
//             buildKey(Colors.green, 4),
//             buildKey(Colors.teal, 5),
//             buildKey(Colors.blue, 6),
//             buildKey(Colors.pink, 7),
//           ],
//         ),
//       ),
//     );
//   }
// }
import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';

void main() {
  runApp(const XylophoneApp());
}

class XylophoneApp extends StatelessWidget {
  const XylophoneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Xylophone',
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF121216),
      ),
      home: const XylophonePage(),
    );
  }
}

class XylophonePage extends StatefulWidget {
  const XylophonePage({super.key});

  @override
  State<XylophonePage> createState() => _XylophonePageState();
}

class _XylophonePageState extends State<XylophonePage> {
  final AudioPlayer _player = AudioPlayer();

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  void playSound(int soundNumber) async {
    await _player.stop();
    await _player.play(AssetSource('note$soundNumber.wav'));
  }

  final List<Map<String, dynamic>> keysData = const [
    {
      'gradient': [Color(0xFFFF5252), Color(0xFFC62828)],
      'note': 'C',
      'solfege': 'DO',
      'number': 1,
      'widthFactor': 1.0,
    },
    {
      'gradient': [Color(0xFFFF9800), Color(0xFFE65100)],
      'note': 'D',
      'solfege': 'RE',
      'number': 2,
      'widthFactor': 0.95,
    },
    {
      'gradient': [Color(0xFFFFEB3B), Color(0xFFF57F17)],
      'note': 'E',
      'solfege': 'MI',
      'number': 3,
      'widthFactor': 0.90,
    },
    {
      'gradient': [Color(0xFF4CAF50), Color(0xFF2E7D32)],
      'note': 'F',
      'solfege': 'FA',
      'number': 4,
      'widthFactor': 0.85,
    },
    {
      'gradient': [Color(0xFF009688), Color(0xFF004D40)],
      'note': 'G',
      'solfege': 'SOL',
      'number': 5,
      'widthFactor': 0.80,
    },
    {
      'gradient': [Color(0xFF2196F3), Color(0xFF1565C0)],
      'note': 'A',
      'solfege': 'LA',
      'number': 6,
      'widthFactor': 0.75,
    },
    {
      'gradient': [Color(0xFF9C27B0), Color(0xFF6A1B9A)],
      'note': 'B',
      'solfege': 'TI',
      'number': 7,
      'widthFactor': 0.70,
    },
  ];

  Widget buildKey(Map<String, dynamic> data) {
    final List<Color> gradientColors = data['gradient'];
    final String note = data['note'];
    final String solfege = data['solfege'];
    final int soundNumber = data['number'];
    final double widthFactor = data['widthFactor'];

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5.0, horizontal: 12.0),
        child: Center(
          child: FractionallySizedBox(
            widthFactor: widthFactor,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: gradientColors,
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: gradientColors[0].withOpacity(0.4),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                  const BoxShadow(
                    color: Colors.black38,
                    blurRadius: 4,
                    offset: Offset(0, 2),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  splashColor: Colors.white30,
                  highlightColor: Colors.white10,
                  onTap: () => playSound(soundNumber),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        // Left screw pin icon
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withOpacity(0.4),
                          ),
                        ),
                        // Musical Note & Solfege Name
                        Row(
                          children: [
                            Text(
                              note,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                                letterSpacing: 1.2,
                                shadows: [
                                  Shadow(
                                    color: Colors.black45,
                                    offset: Offset(1, 1),
                                    blurRadius: 3,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '($solfege)',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: Colors.white.withOpacity(0.85),
                              ),
                            ),
                          ],
                        ),
                        // Right screw pin icon
                        Container(
                          width: 12,
                          height: 12,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white.withOpacity(0.4),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        centerTitle: true,
        elevation: 8,
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF1E1E2C), Color(0xFF2A2D3E)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.music_note_rounded, color: Color(0xFFFFD700), size: 28),
            SizedBox(width: 8),
            Text(
              'Xylophone Master',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 22,
                letterSpacing: 1.1,
                color: Colors.white,
              ),
            ),
            SizedBox(width: 8),
            Icon(Icons.music_note_rounded, color: Color(0xFFFFD700), size: 28),
          ],
        ),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF141419), Color(0xFF1F1F28)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 10),
              ...keysData.map((data) => buildKey(data)),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }
}
