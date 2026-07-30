import 'story.dart';

class StoryBrain {
  int _storyNumber = 0;

  final List<Story> _storyData = [
    Story(
      storyTitle:
          'Your car has blown a tire on a deserted road with no cell phone reception. You decide to hitchhike. A rusty pickup truck lurches to a halt next to you. A man with a brimmed hat and lifeless eyes opens the passenger door for you and asks: "Need a ride, boy?".',
      choice1: 'I\'ll hop in. Thanks for the help!',
      choice2: 'Better ask him if he\'s a murderer first.',
    ),
    Story(
      storyTitle: 'He nods slowly, unphased by the question.',
      choice1: 'At least he\'s honest. I\'ll climb in.',
      choice2: 'Wait, I know how to change a tire.',
    ),
    Story(
      storyTitle:
          'As you begin to drive, the stranger starts talking about his relationship with his mother. He gets angrier and angrier by the minute. He asks you to open the glovebox. Inside you find a bloody knife, two fingers, and a cassette tape of Dr. Dre. He reaches for the glovebox.',
      choice1: 'I love Dr. Dre! Hand it over.',
      choice2: 'It\'s him or me! You stab him with the knife.',
    ),
    Story(
      storyTitle:
          'What? Such a cop out! Did you know traffic accidents are the second leading cause of accidental death for most adult age groups?',
      choice1: 'Restart',
      choice2: '',
    ),
    Story(
      storyTitle:
          'As you smash through the guardrail and careen towards the jagged rocks below you reflect on the dubious wisdom of stabbing someone while they are driving a car you are in.',
      choice1: 'Restart',
      choice2: '',
    ),
    Story(
      storyTitle:
          'You bond with the murderer over verses of "Nuthin\' but a \'G\' Thang". He drops you off at the next town. He asks you if you know any good places to dump bodies. You reply: "Try the pier".',
      choice1: 'Restart',
      choice2: '',
    ),
  ];

  String getStory() {
    return _storyData[_storyNumber].storyTitle;
  }

  String getChoice1() {
    return _storyData[_storyNumber].choice1;
  }

  String getChoice2() {
    return _storyData[_storyNumber].choice2;
  }

  void nextStory(int choiceNumber) {
    // Decision Tree logic
    if (_storyNumber == 0) {
      if (choiceNumber == 1) {
        _storyNumber = 2;
      } else if (choiceNumber == 2) {
        _storyNumber = 1;
      }
    } else if (_storyNumber == 1) {
      if (choiceNumber == 1) {
        _storyNumber = 2;
      } else if (choiceNumber == 2) {
        _storyNumber = 3;
      }
    } else if (_storyNumber == 2) {
      if (choiceNumber == 1) {
        _storyNumber = 5;
      } else if (choiceNumber == 2) {
        _storyNumber = 4;
      }
    } else if (_storyNumber == 3 || _storyNumber == 4 || _storyNumber == 5) {
      restart();
    }
  }

  void restart() {
    _storyNumber = 0;
  }

  bool buttonShouldBeVisible() {
    // Show Choice 2 button only if we are on story 0, 1, or 2
    if (_storyNumber == 0 || _storyNumber == 1 || _storyNumber == 2) {
      return true;
    } else {
      return false;
    }
  }
}
