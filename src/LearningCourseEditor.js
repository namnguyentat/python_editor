import React from 'react';
import ReadOnlyEditor from './editors/ReadOnlyEditor';
import GrayoutEditor from './editors/GrayoutEditor';
import TextBoxEditor from './editors/TextBoxEditor';

const readOnly_1 = `# Type your code here
import random

a = 1
b = True
c = 'String'`;
const grayout_1 = `d = [1, 2, 3]
`;
const grayout_2 = `def print_random():
    print(random.randint(1, 10))
    print_hello()
    print(random.randint(1, 10))
    print_hello()
    return 4
`;
const readOnly_2 = `
while True:
    te = random.randomrang(0, 2)
    if te == 0:
        koov.multicolormatrix("v2").display("gu", 0)
    elif te == 1:
        koov.multicolormatrix("v2").display("par", 0)
    # write code when te is equal 2 here`;
const textbox_1 = `
`;
const deafultCode = `# Type your code here
import random

a = 1
b = True
c = 'String'
d = [1, 2, 3]

def print_random():
    print(random.randint(1, 10))
    print_hello()
    print(random.randint(1, 10))
    print_hello()
    return 4

while True:
  fill_var = random.randomrange(fill_arg, fill_arg)

def print_hello():
    if True:
        print('Hello')
        if True:
            print('World')


print('hello world')
print('aaaa')
print_random()
`;

class LearningCourseEditor extends React.Component {
  constructor(props) {
    super(props);
    this.code = deafultCode;
  }

  render() {
    return (
      <div>
        <ReadOnlyEditor code={readOnly_1} />
        <GrayoutEditor
          code={grayout_1}
          showCorrectAfaterFinish={true}
          lineNumberStartForm={readOnly_1.split('\n').length}
        />
        <GrayoutEditor
          code={grayout_2}
          comments={[{ line: 1, text: 'print random function, use random' }]}
          lineNumberStartForm={
            readOnly_1.split('\n').length + grayout_1.split('\n').length
          }
        />
        <ReadOnlyEditor
          code={readOnly_2}
          lineNumberStartForm={
            readOnly_1.split('\n').length +
            grayout_1.split('\n').length +
            grayout_2.split('\n').length
          }
        />
        <TextBoxEditor
          code={textbox_1}
          lineNumberStartForm={
            readOnly_1.split('\n').length +
            grayout_1.split('\n').length +
            grayout_2.split('\n').length +
            readOnly_2.split('\n').length
          }
          showCorrectAfaterFinish={true}
          numberOfLines={2}
        />
      </div>
    );
  }
}

export default LearningCourseEditor;
